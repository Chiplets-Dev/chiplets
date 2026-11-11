import { CRASH_CAP, multAt, msFor } from '../math/crash.js';
import { startCrash, crashEnd, crashSettle, cashoutCrash } from '../rules/crash.js';

const kit = window.Chiplets && window.Chiplets.__kit;
if (!kit) throw new Error('Chiplets: load chiplets.js before the game files.');
const { ChipGame, cfg, rand, fmt, fmtX, esc, sound, reducedMotion, money, rules } = kit;
rules.crash = { start: startCrash, end: crashEnd, settle: crashSettle, cashout: cashoutCrash };

const REPLAY_MAX = 1500; // after a cash-out, the rest of the round plays out in at most this long
const STARS = Array.from({ length: 42 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

class ChipCrash extends ChipGame {
  static game = 'crash';
  static css = `
.crash{position:relative}
.big{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.big .m{font-size:clamp(34px,14cqi,64px);font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em;text-shadow:0 4px 30px #0008}
.big .s{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--chip-muted);margin-top:2px}
.big.bust .m{color:var(--chip-lose)} .big.won .m{color:var(--chip-win)}
.hist{display:flex;gap:5px;overflow:hidden;margin-top:10px;mask-image:linear-gradient(90deg,#000 80%,transparent)}
.hist span{flex:none;font-size:11px;font-weight:800;padding:3px 7px;border-radius:999px;background:var(--chip-panel);border:1px solid var(--chip-line);font-variant-numeric:tabular-nums}
.hist .lo{color:var(--chip-lose)} .hist .hi{color:var(--chip-win)} .hist .mega{color:var(--chip-gold)}
`;

  build() {
    this.hist = [];
    this.shell(
      'Crash',
      `<div class="crash"><canvas aria-hidden="true"></canvas><div class="big"><div class="m">1.00×</div><div class="s">Place a bet</div></div></div>`,
      `<div class="controls">${this.betField()}<button class="go" type="button">Bet</button></div>
       <div class="row"><div class="field" style="flex:1"><label>Auto cash out ×</label><input class="auto" type="number" inputmode="decimal" min="1.01" step="0.01" placeholder="off" aria-label="Auto cash out multiplier"></div></div>`,
      `<div class="hist" aria-label="Recent rounds"></div>`,
      { auto: true },
    );
    this.$('.auto').value = this.getAttribute('auto') || '2.00';
    this.cv = this.$('canvas');
    this.cx = this.cv.getContext('2d');
    this.bindPrimary(() => (this.round && this.round.live ? this.cashout() : !this.cooling && this.start()));
    this.hum = sound.hum();
    this.layout();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.$('.stage'));
    this.say('Cash out before it crashes.');
    this.resumeRound();
  }

  // A round still running on the engine (signed in: survives reloads and other devices) picks up here.
  async resumeRound() {
    if (this.round?.live || this.starting) return;
    const eng = money.engine;
    let st = null;
    try {
      st = await eng.crash.active?.();
    } catch (e) {}
    if (!st || money.engine !== eng || this.round?.live || this.starting) return;
    const r = (this.round = { bet: st.bet, auto: st.auto, eng, t0: performance.now() - st.elapsed, m: 1, live: true, cashAt: null, cp: null, replay: false, done: false });
    const big = this.$('.big');
    big.className = 'big';
    big.querySelector('.s').textContent = r.auto ? `Auto at ${fmtX(r.auto)}` : 'Live';
    this.say('Round resumed.');
    if (!this.quiet) this.hum.start();
    this.sync();
    this.tick();
    this.watch(r);
  }

  engineChanged() {
    this.resumeRound();
  }

  liveRound() {
    return !!this.round?.live || !!this.starting;
  }
  autoCheck() {
    const v = parseFloat(this.$('.auto').value);
    return Number.isFinite(v) && v >= 1.01 ? null : 'Set an auto cash-out of 1.01× or more to use autoplay.';
  }
  autoStep() {
    return this.start();
  }
  autoGap() {
    return 900;
  }

  layout() {
    const w = this.$('.stage').clientWidth || 320;
    const h = Math.round(Math.min(320, w * 0.62));
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = w * d;
    this.cv.height = h * d;
    this.cv.style.height = h + 'px';
    this.cx.setTransform(d, 0, 0, d, 0, 0);
    this.W = w;
    this.H = h;
    this.paint();
  }

  syncGame() {
    const go = this.$('.go');
    const live = this.round && this.round.live;
    go.textContent = live ? (this.round.cashing ? 'Cashing out…' : `Cash out ${fmt(Math.floor(this.round.bet * this.round.m))}`) : this.starting ? 'Starting…' : 'Bet';
    go.classList.toggle('cash', !!live);
    go.disabled = live ? !!this.round.cashing : this.cooling || !!this.starting;
    this.$('.bet').disabled = !!live;
    this.$('.auto').disabled = !!live || !!this.autoRun;
  }

  // The engine (browser or server) holds the crash point. This side only animates the climb and asks the
  // engine when the round is over — so nothing in the browser can know the crash point early.
  async start() {
    const bet = this.betCents();
    const autoV = parseFloat(this.$('.auto').value);
    const auto = Number.isFinite(autoV) && autoV >= 1.01 ? Math.min(CRASH_CAP, Math.floor(autoV * 100) / 100) : null;
    if (this.starting || !this.take(bet)) return false;
    const eng = money.engine;
    this.starting = true;
    this.sync();
    const t = performance.now();
    let res;
    try {
      res = await money.call((e) => e.crash.start({ bet, auto }), { engine: eng });
    } catch (err) {
      this.fail(err);
      return false;
    } finally {
      this.starting = false;
      this.sync();
    }
    const lag = eng.kind === 'local' ? 0 : (performance.now() - t) / 2; // the server started its clock mid-request
    cancelAnimationFrame(this.raf);
    if (this.round && !this.round.logged && this.round.cp) this.log(this.round); // its replay was still running
    const r = (this.round = { bet, auto: res.auto ?? auto, eng, t0: performance.now() - lag - (res.elapsed || 0), m: 1, live: true, cashAt: null, cp: null, replay: false, done: false });
    const big = this.$('.big');
    big.className = 'big';
    big.querySelector('.s').textContent = r.auto ? `Auto at ${fmtX(r.auto)}` : 'Live';
    this.say(r.auto ? `Auto cash out at ${fmtX(r.auto)}.` : 'Hit cash out before it crashes.');
    if (!this.quiet) this.hum.start();
    this.sync();
    this.paintBalance();
    this.tick();
    this.watch(r);
    return true;
  }

  // Waits for the engine to say the round is over (crash or auto cash-out), retrying through network blips.
  async watch(r) {
    while (this.round === r && r.live) {
      let w;
      try {
        w = await money.call((e) => e.crash.watch(), { engine: r.eng });
      } catch (err) {
        if (err.code === 'auth') return this.fail(err);
        await new Promise((ok) => setTimeout(ok, 1000));
        continue;
      }
      if (w?.ended && !w.none) return this.finish(r, w);
      if (w?.none) return this.finish(r, { won: false, payout: 0, multiplier: 0, cp: r.m }); // lost track of it
    }
  }

  tick() {
    this.raf = requestAnimationFrame(() => {
      const r = this.round;
      if (!r || !r.live) return;
      let m = Math.floor(multAt(performance.now() - r.t0) * 100) / 100;
      if (r.auto && m >= r.auto) m = r.auto; // reached the target: the engine is settling it
      r.m = m;
      this.$('.big .m').textContent = fmtX(m);
      this.hum.set(m);
      this.paint();
      this.sync();
      this.tick();
    });
  }

  async cashout() {
    const r = this.round;
    if (!r || !r.live || r.cashing) return;
    r.cashing = true;
    this.sync();
    let res;
    try {
      res = await money.call((e) => e.crash.cashout(), { engine: r.eng });
    } catch (err) {
      r.cashing = false;
      if (err.code !== 'none') this.fail(err); // 'none' = it had already ended; watch() reports that
      return this.sync();
    }
    this.finish(r, res);
  }

  finish(r, res) {
    if (this.round !== r || !r.live) return;
    r.live = false;
    r.cashing = false;
    r.cp = res.cp;
    cancelAnimationFrame(this.raf);
    this.hum.stop();
    const won = !!res.won;
    r.m = won ? res.multiplier : res.cp;
    if (won) r.cashAt = res.multiplier;
    this.cooldown();
    const profit = this.settle('crash', r.bet, res.payout, won ? res.multiplier : 0, { crashPoint: res.cp, cashedOutAt: won ? res.multiplier : null });
    const big = this.$('.big');
    if (won) {
      big.className = 'big won';
      big.querySelector('.m').textContent = fmtX(r.m);
      big.querySelector('.s').textContent = 'Cashed out';
      this.celebrate(r.m, profit, this.headPoint(), 'cash');
      this.say(`<b class="win">+${fmt(profit)} ${esc(this.currency)}</b> at ${fmtX(r.m)}`);
      this.replay(r);
    } else {
      this.explode(r, true);
      this.say(`<b class="lose">Crashed at ${fmtX(r.cp)}</b> · −${fmt(r.bet)}`);
    }
    this.sync();
    this.paintBalance();
  }

  // After a cash-out, the round keeps going (sped up) to where it was always going to crash.
  replay(r) {
    if (r.cp <= r.m || reducedMotion()) return this.explode(r, false);
    const from = r.m;
    const D = Math.min(REPLAY_MAX, msFor(r.cp) - msFor(from));
    const t0 = performance.now();
    r.replay = true;
    const step = () => {
      if (this.round !== r) return; // a new round started
      const k = Math.min(1, (performance.now() - t0) / D);
      r.m = from * (r.cp / from) ** k;
      this.paint();
      if (k < 1) this.raf = requestAnimationFrame(step);
      else this.explode(r, false);
    };
    this.raf = requestAnimationFrame(step);
  }

  explode(r, lost) {
    r.m = r.cp;
    r.replay = false;
    r.done = true;
    const big = this.$('.big');
    if (lost) {
      big.className = 'big bust';
      big.querySelector('.m').textContent = fmtX(r.cp);
      big.querySelector('.s').textContent = 'Crashed';
      this.sfx('boom');
      this.buzz([70, 30, 140]);
      this.fx.shake();
    } else big.querySelector('.s').textContent = `Cashed out · crashed at ${fmtX(r.cp)}`;
    this.paint();
    const at = this.headPoint();
    this.fx.burst(at.x, at.y);
    this.log(r);
  }

  log(r) {
    r.logged = true;
    this.hist.unshift(r.cp);
    this.hist.length = Math.min(this.hist.length, 14);
    this.$('.hist').innerHTML = this.hist.map((x) => `<span class="${x < 2 ? 'lo' : x >= 10 ? 'mega' : 'hi'}">${fmtX(x)}</span>`).join('');
  }

  // Chart geometry for a given top multiplier.
  geom(m) {
    const pad = 18;
    const maxM = Math.max(2, m * 1.25);
    const tMax = Math.max(msFor(maxM), 6000);
    return {
      maxM,
      pad,
      X: (t) => pad + (t / tMax) * (this.W - pad * 2),
      Y: (v) => this.H - pad - ((v - 1) / (maxM - 1)) * (this.H - pad * 2),
    };
  }

  // Where the rocket is, in the effects canvas' coordinates.
  headPoint() {
    const m = this.round ? this.round.m : 1;
    const g = this.geom(m);
    const c = this.cv.getBoundingClientRect();
    const b = this.box.getBoundingClientRect();
    return { x: c.left - b.left + g.X(msFor(m)), y: c.top - b.top + g.Y(m) };
  }

  paint() {
    if (!this.W) return;
    const r = this.round;
    this.draw({
      m: r ? r.m : 1,
      started: !!r,
      moving: !!r && (r.live || r.replay),
      bust: !!r && r.done && !r.cashAt,
      cashAt: r?.cashAt,
      auto: r?.live ? r.auto : null,
      t: r ? performance.now() - r.t0 : 0,
    });
  }

  draw(s) {
    const c = this.cx;
    const { W, H } = this;
    const cs = getComputedStyle(this);
    const muted = cs.getPropertyValue('--chip-muted').trim();
    const g = this.geom(s.m);
    c.clearRect(0, 0, W, H);
    // stars streaming past while it climbs
    if (s.moving && !reducedMotion()) {
      const off = (s.t / 1000) * (0.05 + 0.05 * Math.log2(Math.max(1, s.m)));
      c.fillStyle = muted;
      for (const st of STARS) {
        const x = (((st.x - off * st.z) % 1) + 1) % 1;
        const y = (((st.y + off * st.z * 0.6) % 1) + 1) % 1;
        c.globalAlpha = 0.12 + st.z * 0.3;
        c.fillRect(x * W, y * H, 1 + st.z, 1 + st.z);
      }
      c.globalAlpha = 1;
    }
    // grid lines
    c.strokeStyle = cs.getPropertyValue('--chip-line').trim() || '#fff2';
    c.lineWidth = 1;
    c.fillStyle = muted;
    c.font = '700 10px ui-sans-serif,system-ui';
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const stepM = g.maxM <= 3 ? 0.5 : g.maxM <= 6 ? 1 : g.maxM <= 20 ? 5 : g.maxM <= 60 ? 10 : g.maxM <= 200 ? 50 : 250;
    for (let v = 1; v <= g.maxM; v += stepM) {
      const y = g.Y(v);
      c.beginPath();
      c.moveTo(g.pad, y);
      c.lineTo(W - g.pad, y);
      c.stroke();
      c.fillText(v.toFixed(v % 1 ? 1 : 0) + '×', g.pad + 2, y - 3);
    }
    // the auto cash-out target
    if (s.auto && s.auto <= g.maxM) {
      const y = g.Y(s.auto);
      c.save();
      c.setLineDash([5, 5]);
      c.strokeStyle = cs.getPropertyValue('--chip-win').trim();
      c.globalAlpha = 0.6;
      c.beginPath();
      c.moveTo(g.pad, y);
      c.lineTo(W - g.pad, y);
      c.stroke();
      c.restore();
    }
    if (!s.started) return;
    // the curve
    const tEnd = msFor(Math.max(1, s.m));
    const color = s.bust ? cs.getPropertyValue('--chip-lose').trim() : cs.getPropertyValue('--chip-accent').trim();
    const N = 60;
    const curve = () => {
      c.beginPath();
      c.moveTo(g.X(0), g.Y(1));
      for (let i = 1; i <= N; i++) {
        const t = (tEnd * i) / N;
        c.lineTo(g.X(t), g.Y(multAt(t)));
      }
    };
    curve();
    c.lineTo(g.X(tEnd), g.Y(1));
    c.closePath();
    c.fillStyle = color;
    c.globalAlpha = 0.16;
    c.fill();
    c.globalAlpha = 1;
    curve();
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.stroke();
    // where you cashed out
    if (s.cashAt) {
      const x = g.X(msFor(s.cashAt));
      const y = g.Y(s.cashAt);
      const right = x > W - 80;
      c.fillStyle = cs.getPropertyValue('--chip-win').trim();
      c.beginPath();
      c.arc(x, y, 6, 0, 7);
      c.fill();
      c.strokeStyle = cs.getPropertyValue('--chip-bg').trim();
      c.lineWidth = 2;
      c.stroke();
      c.font = '800 11px ui-sans-serif,system-ui';
      c.textAlign = right ? 'right' : 'left';
      c.fillText(`You: ${fmtX(s.cashAt)}`, x + (right ? -10 : 10), y - 8);
    }
    // the rocket
    const x1 = g.X(tEnd);
    const y1 = g.Y(s.m);
    if (s.moving) {
      const tb = Math.max(0, tEnd - 250);
      const ang = Math.atan2(y1 - g.Y(multAt(tb)), x1 - g.X(tb));
      c.save();
      c.translate(x1, y1);
      c.rotate(ang + Math.PI / 4); // the emoji points up-right
      c.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",ui-sans-serif,sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🚀', 0, 0);
      c.restore();
    } else if (!s.bust && !s.cashAt) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x1, y1, 5, 0, 7);
      c.fill();
    }
  }

  // A live round keeps running (and can still crash or auto cash out) if the element was re-attached.
  mounted() {
    if (this.round && this.round.live) this.tick();
  }

  unmounted() {
    cancelAnimationFrame(this.raf);
    this.hum.stop();
  }
}

if (!customElements.get('chip-crash')) customElements.define('chip-crash', ChipCrash);

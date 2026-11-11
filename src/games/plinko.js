import { plinkoTable, ROWS_MIN, ROWS_MAX, RISKS } from '../math/plinko.js';
import { playPlinko } from '../rules/plinko.js';

const kit = window.Chiplets && window.Chiplets.__kit;
if (!kit) throw new Error('Chiplets: load chiplets.js before the game files.');
const { ChipGame, cfg, rand, fmt, fmtX, money, rules } = kit;
rules.plinko = { play: playPlinko };

const GLOW_MS = 320;

class ChipPlinko extends ChipGame {
  static game = 'plinko';
  static autoParallel = true; // autoplay keeps dropping while earlier balls are still falling

  build() {
    this.rows = Math.min(ROWS_MAX, Math.max(ROWS_MIN, +this.getAttribute('rows') || 12));
    this.risk = RISKS.includes(this.getAttribute('risk')) ? this.getAttribute('risk') : 'medium';
    this.balls = [];
    this.flash = [];
    this.glow = [];
    this.asking = 0; // drops waiting for the engine's answer
    const rowOpts = Array.from({ length: ROWS_MAX - ROWS_MIN + 1 }, (_, i) => i + ROWS_MIN)
      .map((n) => `<option${n === this.rows ? ' selected' : ''}>${n}</option>`)
      .join('');
    const riskOpts = RISKS.map((r) => `<option value="${r}"${r === this.risk ? ' selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('');
    this.shell(
      'Plinko',
      `<canvas aria-label="Plinko board"></canvas>`,
      `<div class="controls">${this.betField()}<button class="go" type="button">Drop</button></div>
       <div class="row"><div class="field" style="flex:1"><label>Rows</label><select class="rows">${rowOpts}</select></div>
       <div class="field" style="flex:1"><label>Risk</label><select class="risk">${riskOpts}</select></div>
       <div class="field" style="flex:1"><label>Balls</label><select class="count" aria-label="Balls per drop"><option>1</option><option>5</option><option>10</option></select></div></div>`,
      '',
      { turbo: true, auto: true },
    );
    this.cv = this.$('canvas');
    this.cx = this.cv.getContext('2d');
    this.bindPrimary(() => this.dropMany(+this.$('.count').value || 1));
    this.$('.rows').addEventListener('change', (e) => {
      this.rows = +e.target.value;
      this.layout();
    });
    this.$('.risk').addEventListener('change', (e) => {
      this.risk = e.target.value;
      this.layout();
    });
    this.layout(); // right away, so a click before the first resize still has a board and a payout table
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.$('.stage'));
    this.say('Drop a ball. Edges pay the most.');
  }

  // Board settings lock while balls are in the air.
  syncGame() {
    const busy = this.balls.length > 0 || this.asking > 0;
    this.$('.rows').disabled = busy;
    this.$('.risk').disabled = busy;
    this.$('.count').disabled = !!this.autoRun;
  }

  autoStep() {
    return this.drop();
  }
  autoGap() {
    return this.fast ? 140 : 300;
  }

  layout() {
    const w = this.$('.stage').clientWidth || 320;
    const h = Math.round(w * 0.86);
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = w * d;
    this.cv.height = h * d;
    this.cv.style.height = h + 'px';
    this.cx.setTransform(d, 0, 0, d, 0, 0);
    this.W = w;
    this.H = h;
    this.table = plinkoTable(this.rows, this.risk, cfg.rtp);
    this.draw(performance.now());
  }

  geo() {
    const n = this.rows;
    const s = this.W / (n + 2.2);
    const top = s * 0.9;
    const gapY = (this.H - top - s * 1.25) / n;
    return {
      n,
      s,
      top,
      gapY,
      px: (r, j) => this.W / 2 + (j - (r + 2) / 2) * s,
      py: (r) => top + r * gapY,
      bx: (k) => this.W / 2 + (k - n / 2) * s,
      by: top + n * gapY - gapY * 0.25,
    };
  }

  dropMany(n) {
    if (!this.take(this.betCents())) return;
    this.drop();
    for (let i = 1; i < n; i++) setTimeout(() => this.drop(), i * (this.fast ? 70 : 110));
  }

  async drop() {
    const bet = this.betCents();
    if (!this.take(bet)) return false;
    const rows = this.rows;
    const risk = this.risk;
    // The engine picks the path; the payout stays hidden until the ball lands.
    this.asking++;
    this.sync();
    let res;
    try {
      res = await money.call((e) => e.play('plinko', { bet, rows, risk }), { hold: true });
    } catch (err) {
      this.fail(err);
      return false;
    } finally {
      this.asking--;
      this.sync();
    }
    const { path, bucket } = res;
    const pre = [0];
    for (const v of path) pre.push(pre[pre.length - 1] + v);
    this.balls.push({
      path,
      pre,
      bucket,
      bet,
      n: rows,
      risk,
      mult: res.multiplier,
      payout: res.payout,
      step: this.fast ? 62 : 115, // ms per row
      t0: performance.now(),
      row: 0,
      trail: [],
      jitter: (rand() - 0.5) * 0.25,
    });
    this.sync();
    if (!this.raf) this.loop();
    return true;
  }

  pos(b, now) {
    const g = this.geo();
    const t = (now - b.t0) / b.step;
    const r = Math.min(Math.floor(t), b.n);
    const f = t - r;
    const x = (i) => this.W / 2 + (b.pre[i] - i / 2) * g.s;
    const y = (i) => (i === 0 ? g.top - g.gapY * 0.9 : g.py(i - 1) + g.gapY * 0.05) - g.s * 0.18;
    if (r >= b.n) return { x: x(b.n), y: g.by, row: b.n, done: t > b.n + 0.35 };
    const ease = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const x0 = x(r), x1 = x(r + 1), y0 = y(r), y1 = y(r + 1);
    return {
      x: x0 + (x1 - x0) * ease + b.jitter * g.s * Math.sin(Math.PI * f),
      y: y0 + (y1 - y0) * f * f - Math.sin(Math.PI * f) * g.gapY * 0.35,
      row: r,
      done: false,
    };
  }

  loop() {
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      const keep = [];
      for (const b of this.balls) {
        const p = this.pos(b, now);
        // Each row the ball passes, it brushes a peg: light it up and ping.
        while (b.row < p.row) {
          const i = b.row++;
          const R = b.pre[i + 1];
          this.glow.push({ r: i, j: b.path[i] ? R : R + 1, t: now });
          this.sfx('peg', { row: i });
        }
        b.trail.push({ x: p.x, y: p.y });
        if (b.trail.length > 6) b.trail.shift();
        if (p.done) this.land(b, now);
        else keep.push(b);
      }
      this.balls = keep;
      this.flash = this.flash.filter((f) => now - f.t < 900);
      this.glow = this.glow.filter((g) => now - g.t < GLOW_MS);
      this.draw(now);
      this.sync();
      if (this.balls.length || this.flash.length || this.glow.length) this.loop();
    });
  }

  land(b, now) {
    const payout = b.payout;
    const profit = this.settle('plinko', b.bet, payout, b.mult, { rows: b.n, risk: b.risk, bucket: b.bucket }, { held: true });
    this.flash.push({ k: b.bucket, t: now, text: (profit >= 0 ? '+' : '−') + fmt(Math.abs(profit)), win: profit > 0 });
    this.sfx('land', { mult: b.mult });
    if (b.mult >= 10 && b.n === this.rows) {
      const g = this.geo();
      const c = this.cv.getBoundingClientRect();
      const box = this.box.getBoundingClientRect();
      this.celebrate(b.mult, profit, { x: c.left - box.left + g.bx(b.bucket), y: c.top - box.top + g.by });
    } else if (profit > 0) this.buzz(10);
    this.say(`${fmtX(b.mult)} · ${profit > 0 ? `<b class="win">+${fmt(profit)}</b>` : profit < 0 ? `<b class="lose">−${fmt(-profit)}</b>` : 'even'}`);
    this.paintBalance();
  }

  color(k) {
    const d = Math.abs(k - this.rows / 2) / (this.rows / 2);
    return `hsl(${48 - 48 * d}, 92%, ${56 - 6 * d}%)`;
  }

  draw(now) {
    if (!this.W) return;
    const c = this.cx;
    const g = this.geo();
    const cs = getComputedStyle(this);
    const accent = cs.getPropertyValue('--chip-accent').trim() || '#8b5cf6';
    c.clearRect(0, 0, this.W, this.H);
    // pegs
    c.fillStyle = cs.getPropertyValue('--chip-muted').trim() || '#aaa';
    const pr = Math.max(1.6, g.s * 0.09);
    for (let r = 0; r < g.n; r++)
      for (let j = 0; j < r + 3; j++) {
        c.beginPath();
        c.arc(g.px(r, j), g.py(r), pr, 0, 7);
        c.fill();
      }
    // pegs that were just hit
    for (const h of this.glow) {
      if (h.r >= g.n) continue;
      const a = 1 - (now - h.t) / GLOW_MS;
      c.globalAlpha = a * 0.55;
      c.fillStyle = accent;
      c.beginPath();
      c.arc(g.px(h.r, h.j), g.py(h.r), pr * (2.2 + (1 - a) * 1.6), 0, 7);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(g.px(h.r, h.j), g.py(h.r), pr * 1.15, 0, 7);
      c.fill();
    }
    // buckets
    const bw = g.s * 0.9;
    const bh = Math.min(26, g.s * 0.78);
    const font = Math.max(8, Math.min(13, g.s * 0.34));
    c.font = `800 ${font}px ui-sans-serif,system-ui,sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let k = 0; k <= g.n; k++) {
      const fl = this.flash.find((f) => f.k === k);
      const lift = fl ? Math.max(0, 1 - (now - fl.t) / 300) * 5 : 0;
      const x = g.bx(k) - bw / 2;
      const y = g.by - bh / 2 + 4 + lift;
      c.fillStyle = this.color(k);
      c.globalAlpha = fl ? 1 : 0.88;
      c.beginPath();
      c.roundRect ? c.roundRect(x, y, bw, bh, 5) : c.rect(x, y, bw, bh);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#1a1205';
      const m = this.table.m[k];
      const label = m >= 10 ? String(Math.round(m)) : m >= 1 ? String(+m.toFixed(1)) : String(+m.toFixed(2)).replace(/^0/, '');
      c.fillText(label, g.bx(k), y + bh / 2 + 0.5);
    }
    // floating results
    for (const f of this.flash) {
      const a = (now - f.t) / 900;
      c.globalAlpha = 1 - a;
      c.fillStyle = f.win ? cs.getPropertyValue('--chip-win') : cs.getPropertyValue('--chip-muted');
      c.font = `900 ${font + 2}px ui-sans-serif,system-ui,sans-serif`;
      c.fillText(f.text, g.bx(f.k), g.by - bh - a * 24);
      c.globalAlpha = 1;
    }
    // balls, with a short fading trail
    const br = Math.max(3.5, g.s * 0.2);
    for (const b of this.balls) {
      const p = this.pos(b, now);
      c.fillStyle = accent;
      b.trail.forEach((q, i) => {
        c.globalAlpha = ((i + 1) / b.trail.length) * 0.28;
        c.beginPath();
        c.arc(q.x, q.y, br * (0.45 + (0.5 * i) / b.trail.length), 0, 7);
        c.fill();
      });
      c.globalAlpha = 1;
      c.shadowColor = accent;
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(p.x, p.y, br, 0, 7);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#fff8';
      c.beginPath();
      c.arc(p.x - br * 0.3, p.y - br * 0.3, br * 0.35, 0, 7);
      c.fill();
    }
  }

  // Balls already in the air still land (and pay) if the element was moved or re-attached.
  mounted() {
    if (this.balls.length && !this.raf) this.loop();
  }

  unmounted() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

if (!customElements.get('chip-plinko')) customElements.define('chip-plinko', ChipPlinko);

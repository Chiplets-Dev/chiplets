import { cfg } from './config.js';
import { bus } from './wallet.js';
import { money } from './engine.js';
import { fmt, esc, glyph, makeSheet } from './util.js';
import { prefs, reducedMotion } from './prefs.js';
import { sound, haptic } from './sound.js';
import { createFx } from './fx.js';
import { createAuto } from './autoplay.js';

// Styles every game shares. Each game adds its own on top via `static css`.
const CORE_CSS = `
:host{
  --chip-bg:#15121f; --chip-panel:#1f1b2e; --chip-raised:#2a2540; --chip-line:#ffffff14;
  --chip-fg:#f5f2ff; --chip-muted:#a39cc0; --chip-accent:#8b5cf6; --chip-accent-fg:#fff;
  --chip-win:#34d399; --chip-lose:#fb7185; --chip-gold:#fbbf24;
  --chip-radius:18px; --chip-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  display:block; max-width:var(--chip-max-width,560px); container-type:inline-size;
  font-family:var(--chip-font); color:var(--chip-fg); -webkit-tap-highlight-color:transparent;
}
:host([theme=light]){
  --chip-bg:#f7f5fc; --chip-panel:#ffffff; --chip-raised:#efeaf9; --chip-line:#1b123014;
  --chip-fg:#1b1530; --chip-muted:#6b6485; --chip-win:#059669; --chip-lose:#e11d48; --chip-gold:#d97706;
}
*{box-sizing:border-box}
.box{background:var(--chip-bg);border:1px solid var(--chip-line);border-radius:var(--chip-radius);padding:14px;overflow:hidden;position:relative}
.box:focus{outline:none}
.box:focus-visible{outline:2px solid var(--chip-accent);outline-offset:3px}
button:focus-visible,select:focus-visible{outline:2px solid var(--chip-accent);outline-offset:2px}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.title{font-weight:800;letter-spacing:.02em;font-size:15px;display:flex;align-items:center;gap:8px;min-width:0}
.title .dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--chip-accent);box-shadow:0 0 12px var(--chip-accent)}
.hdr{display:flex;align-items:center;gap:6px;min-width:0}
.snd{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:1px solid var(--chip-line);background:var(--chip-panel);color:var(--chip-muted);cursor:pointer;padding:0}
.snd:hover{color:var(--chip-fg)}
.snd[aria-pressed=true] .x,.snd[aria-pressed=false] .w{display:none}
.bal{display:flex;align-items:center;gap:6px;background:var(--chip-panel);border:1px solid var(--chip-line);border-radius:999px;padding:5px 6px 5px 11px;font-weight:700;font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap}
.bal img{width:16px;height:16px;object-fit:contain}
.bal .cur{color:var(--chip-muted);font-weight:600;font-size:12px}
.refill{border:0;border-radius:999px;background:var(--chip-accent);color:var(--chip-accent-fg);font:inherit;font-size:11px;font-weight:800;padding:4px 9px;cursor:pointer}
.refill[hidden]{display:none}
.stage{background:var(--chip-panel);border:1px solid var(--chip-line);border-radius:calc(var(--chip-radius) - 6px);position:relative;overflow:hidden}
.controls{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.field{display:flex;align-items:center;background:var(--chip-panel);border:1px solid var(--chip-line);border-radius:12px;padding:0 4px 0 10px;min-width:0}
.field:focus-within{border-color:color-mix(in srgb,var(--chip-accent) 70%,transparent)}
.field label{font-size:11px;font-weight:700;color:var(--chip-muted);text-transform:uppercase;letter-spacing:.06em;margin-right:6px;white-space:nowrap}
.field input,.field select{flex:1;min-width:0;width:100%;background:transparent;border:0;color:var(--chip-fg);font:inherit;font-weight:700;font-size:15px;padding:10px 0;outline:none;font-variant-numeric:tabular-nums}
.field select{cursor:pointer;padding-right:4px}
.field select option{background:var(--chip-panel);color:var(--chip-fg)}
.field .unit{color:var(--chip-muted);font-weight:800;padding-right:8px}
.mini{border:0;background:var(--chip-raised);color:var(--chip-fg);font:inherit;font-weight:800;font-size:12px;border-radius:8px;padding:6px 8px;cursor:pointer;margin-left:3px}
.mini:hover{filter:brightness(1.15)}
.mini:disabled{opacity:.45;cursor:not-allowed}
.go{border:0;border-radius:12px;background:var(--chip-accent);color:var(--chip-accent-fg);font:inherit;font-weight:800;font-size:15px;padding:0 22px;min-height:46px;cursor:pointer;box-shadow:0 6px 20px -8px var(--chip-accent);transition:transform .08s,filter .15s;white-space:nowrap}
.go:hover{filter:brightness(1.1)}
.go:active{transform:translateY(1px) scale(.98)}
.go:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.go.cash{background:var(--chip-win);color:#06281c}
.go.stop{background:var(--chip-lose);color:#2a0a10;box-shadow:none}
.tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.pill{border:1px solid var(--chip-line);background:var(--chip-panel);color:var(--chip-muted);font:inherit;font-size:12px;font-weight:800;border-radius:999px;padding:6px 11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.pill:hover:not(:disabled){color:var(--chip-fg)}
.pill[aria-pressed=true]{background:color-mix(in srgb,var(--chip-accent) 24%,var(--chip-panel));color:var(--chip-fg);border-color:color-mix(in srgb,var(--chip-accent) 60%,transparent)}
.pill:disabled{opacity:.45;cursor:not-allowed}
.autop{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.autop[hidden]{display:none}
.msg{min-height:20px;margin-top:10px;font-size:13px;color:var(--chip-muted);text-align:center;font-variant-numeric:tabular-nums}
.msg b.win{color:var(--chip-win)} .msg b.lose{color:var(--chip-lose)}
.pop{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;font-weight:900;font-size:30px;color:var(--chip-win);text-shadow:0 4px 24px #000a;white-space:nowrap;transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .25s;z-index:7;text-align:center;line-height:1.05}
.pop.on{transform:translate(-50%,-50%) scale(1);opacity:1}
.pop.big{font-size:clamp(32px,11cqi,52px);color:var(--chip-gold);text-shadow:0 2px 0 #7c2d12,0 6px 28px #000c}
.pop.big small{display:block;font-size:.36em;letter-spacing:.22em;text-transform:uppercase;color:#fff;text-shadow:0 2px 12px #000c;margin-bottom:4px}
.stat{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:12px;color:var(--chip-muted)}
.stat b{color:var(--chip-fg);font-variant-numeric:tabular-nums}
.foot{display:flex;justify-content:space-between;margin-top:8px;font-size:10.5px;color:var(--chip-muted);opacity:.75}
.foot a{color:inherit}
canvas{display:block;width:100%;touch-action:manipulation}
.fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6}
.box.shake{animation:jolt .5s cubic-bezier(.36,.07,.19,.97)}
@keyframes jolt{10%,90%{transform:translate(-1px,0)}20%,80%{transform:translate(3px,-1px)}30%,50%,70%{transform:translate(-5px,1px)}40%,60%{transform:translate(5px,-1px)}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@container (max-width:380px){.controls{grid-template-columns:1fr}.go{min-height:44px}.bal .cur{display:none}}
`;

const SPEAKER = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path class="w" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/><path class="x" d="m16 9 5 6m0-6-5 6"/></svg>`;

const AUTO_PANEL = `<div class="autop" hidden>
  <div class="field"><label>Rounds</label><select class="a-rounds"><option>5</option><option selected>10</option><option>25</option><option>50</option><option>100</option><option value="0">∞</option></select></div>
  <div class="field"><label>Stop on win ×</label><input class="a-winx" type="number" min="1.01" step="any" inputmode="decimal" placeholder="off" aria-label="Stop on a win of at least this multiplier"></div>
  <div class="field"><label>Stop at +</label><input class="a-profit" type="number" min="0" step="any" inputmode="decimal" placeholder="off" aria-label="Stop once total profit reaches this"></div>
  <div class="field"><label>Stop at −</label><input class="a-loss" type="number" min="0" step="any" inputmode="decimal" placeholder="off" aria-label="Stop once total losses reach this"></div>
</div>`;

const coreSheet = makeSheet(CORE_CSS);
const gameSheets = new WeakMap();

// Space and Enter on any of a game's controls, and whatever is typed into its fields (bar Tab and Escape), belong to
// the game: they must not also set off the host page's own shortcuts (Space to pause a radio, say).
function ownKey(e) {
  const tag = e.composedPath()[0]?.localName;
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return e.key !== 'Tab' && e.key !== 'Escape';
  return e.key === ' ' || e.key === 'Enter' || e.code === 'Space';
}

export class ChipGame extends HTMLElement {
  static get observedAttributes() {
    return ['accent', 'theme'];
  }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const own = this.constructor.css || '';
    if (!gameSheets.has(this.constructor)) gameSheets.set(this.constructor, makeSheet(own));
    const sheets = [coreSheet, gameSheets.get(this.constructor)];
    if (sheets.every(Boolean)) this.root.adoptedStyleSheets = sheets;
    else
      for (const css of [CORE_CSS, own]) {
        const st = document.createElement('style');
        st.textContent = css;
        this.root.append(st);
      }
    this.onBalance = () => this.paintBalance();
    this.onPrefs = () => this.sync();
    this.onEngine = () => {
      this.engineChanged?.();
      this.paintBalance();
    };
  }

  attributeChangedCallback(name, _, value) {
    if (name === 'accent') value ? this.style.setProperty('--chip-accent', value) : this.style.removeProperty('--chip-accent');
  }

  connectedCallback() {
    sound.wantsMuted(this, this.getAttribute('sound') === 'muted');
    if (!this.built) {
      this.built = true;
      this.build();
    }
    bus.addEventListener('balance', this.onBalance);
    bus.addEventListener('prefs', this.onPrefs);
    bus.addEventListener('engine', this.onEngine);
    this.paintBalance();
    this.mounted?.();
  }

  disconnectedCallback() {
    sound.wantsMuted(this, false);
    this.stopAutoHidden();
    bus.removeEventListener('balance', this.onBalance);
    bus.removeEventListener('prefs', this.onPrefs);
    bus.removeEventListener('engine', this.onEngine);
    this.unmounted?.();
  }

  // Which game this is ('slots', 'plinko', …). Not `game`: Mines uses that for the round in progress.
  get kind() {
    return this.constructor.game;
  }
  get currency() {
    return this.getAttribute('currency') || cfg.currency;
  }
  get icon() {
    return this.getAttribute('icon') || cfg.icon;
  }
  // sound="off" silences this one game (no speaker button either); sound="muted" only starts it muted
  get quiet() {
    return this.getAttribute('sound') === 'off';
  }
  get turbo() {
    return !!prefs.get(`turbo:${this.kind}`, this.hasAttribute('turbo'));
  }
  setTurbo(on) {
    prefs.set(`turbo:${this.kind}`, !!on);
  }
  // Short animations: turbo, or the visitor asked for reduced motion.
  get fast() {
    return this.turbo || reducedMotion();
  }

  // The card every game sits in: title, sound + balance, the stage, controls, tools, message, footer.
  // opts: { turbo: true } adds a Turbo switch, { auto: true } adds Autoplay, { tools: html } adds more.
  shell(title, stage, controls, extra = '', opts = {}) {
    const auto = opts.auto && !this.hasAttribute('no-auto');
    const tools = [
      opts.turbo ? `<button class="pill" type="button" data-tool="turbo" aria-pressed="false" title="Turbo (T)">⚡ Turbo</button>` : '',
      auto ? `<button class="pill" type="button" data-tool="auto" aria-pressed="false" title="Autoplay">↻ Auto</button>` : '',
      opts.tools || '',
    ].join('');
    const name = this.getAttribute('label') || title;
    const wrap = document.createElement('div');
    wrap.className = 'box';
    wrap.setAttribute('part', 'box');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', `${name} game`);
    wrap.setAttribute('aria-keyshortcuts', 'Space Enter M');
    wrap.innerHTML = `
      <div class="top"><div class="title"><span class="dot"></span>${esc(name)}</div>
        <div class="hdr">${this.quiet ? '' : `<button class="snd" type="button" aria-pressed="true" aria-label="Sound" title="Sound and vibration (M)">${SPEAKER}</button>`}
        <div class="bal" part="balance">${glyph(this.icon)}<span class="amt">0</span><span class="cur">${esc(this.currency)}</span><button class="refill" type="button" hidden title="Top your balance back up">Refill</button></div></div></div>
      <div class="stage" part="stage">${stage}</div>
      ${controls}
      ${tools.trim() ? `<div class="tools">${tools}</div>` : ''}
      ${auto ? AUTO_PANEL : ''}
      <div class="msg" aria-live="polite"></div>
      ${extra}
      ${this.hasAttribute('no-footer') ? '' : `<div class="foot"><span>Play money · ${Math.round(cfg.rtp * 100)}% RTP</span><a href="https://chiplets.dev" target="_blank" rel="noopener">chiplets</a></div>`}
      <div class="pop"></div>`;
    this.root.append(wrap);
    this.box = wrap;
    this.$ = (s) => wrap.querySelector(s);
    this.$$ = (s) => [...wrap.querySelectorAll(s)];

    this.$('.refill').addEventListener('click', () => this.refill());
    this.$('.snd')?.addEventListener('click', () => sound.toggle());
    this.$('[data-tool=turbo]')?.addEventListener('click', () => this.setTurbo(!this.turbo));
    this.$('[data-tool=auto]')?.addEventListener('click', () => this.setAutoMode(!this.autoMode));
    // Browsers only allow sound after a gesture, so every tap or key press inside the game unlocks it.
    for (const ev of ['pointerdown', 'keydown', 'click']) wrap.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
    wrap.addEventListener('keydown', (e) => this.onKeydown(e));
    for (const ev of ['keyup', 'keypress']) wrap.addEventListener(ev, (e) => ownKey(e) && e.stopPropagation());

    const bet = this.$('.bet');
    if (bet) {
      bet.value = this.getAttribute('bet') || cfg.bet;
      this.$$('[data-bet]').forEach((b) =>
        b.addEventListener('click', () => {
          const v = +bet.value || 0;
          const k = b.dataset.bet;
          bet.value =
            k === 'half' ? Math.max(0.01, +(v / 2).toFixed(2)) : k === 'double' ? +(v * 2).toFixed(2) : +(money.cents / 100).toFixed(2);
          this.paintBalance();
        }),
      );
      bet.addEventListener('input', () => this.paintBalance());
    }
  }

  betField() {
    return `<div class="field"><label>Bet</label><input class="bet" type="number" inputmode="decimal" min="0.01" step="any" aria-label="Bet amount">
      <button class="mini" type="button" data-bet="half" aria-label="Half bet">½</button><button class="mini" type="button" data-bet="double" aria-label="Double bet">2×</button><button class="mini" type="button" data-bet="max" aria-label="Bet everything">Max</button></div>`;
  }

  betCents() {
    const v = Math.round(parseFloat(this.$('.bet')?.value) * 100);
    return Number.isFinite(v) && v > 0 ? Math.min(v, Math.round(cfg.maxBet * 100)) : 0;
  }

  // The main button. In autoplay mode it starts and stops autoplay instead.
  bindPrimary(fn) {
    this.$('.go').addEventListener('click', () => {
      if (!this.autoMode) return fn();
      this.autoRun ? this.stopAutoSoon() : this.startAuto();
    });
  }

  primary() {
    const go = this.$('.go');
    if (go && !go.disabled) go.click();
  }

  // Space = the main button, Enter = the main button (from the card or the bet box), M = sound, T = turbo.
  onKeydown(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.composedPath()[0];
    const tag = t.localName;
    const typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    const k = e.key;
    let handled = !!this.onKey?.(e, t, typing);
    if (!handled) {
      if (k === ' ' && !typing && tag !== 'button') handled = (this.primary(), true);
      else if (k === 'Enter' && (t === this.box || (tag === 'input' && t.classList.contains('bet')))) handled = (this.primary(), true);
      else if (!typing && (k === 'm' || k === 'M') && !this.quiet) handled = (sound.toggle(), true);
      else if (!typing && (k === 't' || k === 'T') && this.$('[data-tool=turbo]')) handled = (this.setTurbo(!this.turbo), true);
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    } else if (ownKey(e)) e.stopPropagation(); // the browser still does its part (presses the button, types the digit)
  }

  // Games put their own button/field updates in syncGame(); this layers autoplay, turbo and sound on top.
  sync() {
    const bet = this.$('.bet');
    if (bet) bet.disabled = false; // games lock it again in syncGame() when they need to
    this.syncGame?.();
    const go = this.$('.go');
    if (!go) return;
    const run = this.autoRun;
    const autoPill = this.$('[data-tool=auto]');
    const panel = this.$('.autop');
    if (panel) panel.hidden = !this.autoMode;
    if (autoPill) {
      autoPill.setAttribute('aria-pressed', String(!!this.autoMode));
      autoPill.disabled = !this.autoMode && (!!this.busy || !!this.liveRound?.());
    }
    if (this.autoMode) {
      go.classList.remove('cash');
      go.classList.toggle('stop', !!run);
      if (run) {
        go.textContent = run.stopping ? 'Stopping…' : `Stop · ${run.left === Infinity ? '∞' : run.left} left`;
        go.disabled = run.stopping;
      } else {
        go.textContent = 'Start auto';
        go.disabled = !!this.busy || this.cooling || !!this.liveRound?.();
      }
      this.$$('.autop input, .autop select').forEach((i) => (i.disabled = !!run));
      if (run && bet) bet.disabled = true; // the bet stays fixed while autoplay runs
    } else go.classList.remove('stop');
    if (bet) this.$$('[data-bet]').forEach((b) => (b.disabled = bet.disabled));
    this.$('[data-tool=turbo]')?.setAttribute('aria-pressed', String(this.turbo));
    this.$('.snd')?.setAttribute('aria-pressed', String(!sound.muted));
  }

  paintBalance() {
    if (!this.$) return;
    const c = money.cents;
    this.$('.amt').textContent = fmt(c);
    if (this._icon !== this.icon) {
      // labels follow Chiplets.config() changes
      this._icon = this.icon;
      this.$('.bal').firstElementChild.outerHTML = glyph(this.icon);
    }
    this.$('.cur').textContent = this.currency;
    this.$('.refill').hidden = !(c < Math.max(1, this.betCents() || 100) && c < cfg.start * 100) || !!this.busy || !!this.autoRun;
    this.sync();
  }

  say(html) {
    this.$('.msg').innerHTML = html;
  }

  pop(text, color) {
    const p = this.$('.pop');
    cancelAnimationFrame(this._pc);
    p.className = 'pop';
    p.textContent = text;
    p.style.color = color || '';
    void p.offsetWidth;
    p.classList.add('on');
    clearTimeout(this._pt);
    this._pt = setTimeout(() => p.classList.remove('on'), 1300);
  }

  // A counting-up banner for big wins.
  bigPop(profit, label) {
    const p = this.$('.pop');
    p.style.color = '';
    p.className = 'pop big on';
    clearTimeout(this._pt);
    cancelAnimationFrame(this._pc);
    const t0 = performance.now();
    const D = reducedMotion() ? 0 : 950;
    const step = (now) => {
      const k = D ? Math.min(1, (now - t0) / D) : 1;
      p.innerHTML = `<small>${esc(label)}</small>+${fmt(Math.round(profit * (1 - (1 - k) ** 3)))}`;
      if (k < 1) this._pc = requestAnimationFrame(step);
    };
    step(t0);
    this._pt = setTimeout(() => (p.className = 'pop'), 2300);
  }

  sfx(name, opts) {
    if (!this.quiet) sound.play(name, opts);
  }
  buzz(pattern) {
    if (!this.quiet) haptic(pattern);
  }
  get fx() {
    return (this._fx ||= createFx(this.box));
  }
  // Centre of an element inside the card, in the effects canvas' coordinates.
  fxPoint(el) {
    const a = el.getBoundingClientRect();
    const b = this.box.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  }

  // Sound, vibration and particles sized to the win. `at` = where the coins burst from;
  // `small` = the sound for an ordinary win.
  celebrate(mult, profit, at, small = 'win') {
    if (profit <= 0) return;
    const tier = mult >= 100 ? 3 : mult >= 10 ? 2 : 1;
    this.sfx(tier === 3 ? 'jackpot' : tier === 2 ? 'bigwin' : small);
    this.buzz(tier === 3 ? [30, 40, 30, 40, 90] : tier === 2 ? [25, 35, 25] : 12);
    if (tier === 1) return this.pop(`+${fmt(profit)}`);
    const p = at || this.fxPoint(this.$('.stage'));
    this.fx.coins(p.x, p.y, tier === 3 ? 44 : 24);
    if (tier === 3) {
      this.fx.confetti();
      this.fx.shake();
    }
    this.bigPop(profit, tier === 3 ? 'Huge win' : 'Big win');
  }

  // After a round ends the main button changes meaning (Cash out → Bet). A short lockout stops a
  // second tap from starting a round nobody meant to play.
  cooldown(ms = 650) {
    this.coolUntil = performance.now() + ms;
    clearTimeout(this._ct);
    this._ct = setTimeout(() => this.sync(), ms + 20);
  }
  get cooling() {
    return performance.now() < (this.coolUntil || 0);
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail: { game: this.kind, ...detail }, bubbles: true, composed: true }));
  }

  // --- autoplay -------------------------------------------------------------------------------------
  // Games provide autoStep() (start one round, false if it couldn't), optionally autoCheck() (a reason
  // autoplay can't start), autoGap() (pause between rounds) and `static autoParallel` (rounds overlap).
  setAutoMode(on) {
    if (!on && this.autoRun) this.stopAutoSoon();
    this.autoMode = !!on;
    this.sync();
  }

  startAuto() {
    const err = this.autoCheck?.();
    if (err) return this.say(err);
    const num = (sel) => {
      const v = parseFloat(this.$(sel)?.value);
      return Number.isFinite(v) && v > 0 ? v : 0;
    };
    this.autoRun = createAuto({
      rounds: +this.$('.a-rounds').value,
      stopProfit: Math.round(num('.a-profit') * 100),
      stopLoss: Math.round(num('.a-loss') * 100),
      stopWinX: num('.a-winx'),
    });
    this.emit('chiplets:auto', { state: 'start' });
    this.say('Autoplay on.');
    this._vis = () => document.visibilityState === 'hidden' && this.stopAutoHidden();
    document.addEventListener('visibilitychange', this._vis);
    if (this.constructor.autoParallel) this._ai = setInterval(() => this.autoNext(), this.autoGap?.() ?? 300);
    this.autoNext();
  }

  autoNext() {
    const run = this.autoRun;
    if (!run) return;
    if (!this.shown) return this.stopAutoHidden();
    if (!run.next()) {
      if (run.finished) this.endAuto();
      return this.sync();
    }
    this.sync();
    Promise.resolve(this.autoStep()).then((ok) => {
      if (ok !== false || this.autoRun !== run) return;
      run.abort('balance');
      if (run.finished) this.endAuto();
      else this.sync();
    });
  }

  // Autoplay only runs while the game can be seen. Removed, display: none (a closed tab or panel) or a hidden page
  // stops it once the rounds in play land; scrolling it out of view doesn't.
  get shown() {
    return this.isConnected && this.getClientRects().length > 0 && document.visibilityState !== 'hidden';
  }
  stopAutoHidden() {
    const run = this.autoRun;
    if (!run) return;
    clearInterval(this._ai);
    if (run.cancel('hidden')) this.endAuto();
    else this.sync();
  }

  stopAutoSoon() {
    const run = this.autoRun;
    if (!run) return;
    if (run.cancel('stopped')) this.endAuto();
    else this.sync();
  }

  autoSettled(profit, multiplier) {
    const run = this.autoRun;
    if (!run) return;
    if (run.result({ profit, multiplier })) return this.endAuto();
    if (!this.constructor.autoParallel && !run.stopping) {
      clearTimeout(this._an);
      this._an = setTimeout(() => this.autoNext(), this.autoGap?.() ?? 400);
    }
  }

  endAuto() {
    const run = this.autoRun;
    if (!run) return;
    this.autoRun = null;
    clearTimeout(this._an);
    clearInterval(this._ai);
    document.removeEventListener('visibilitychange', this._vis);
    const signed = (run.net >= 0 ? '+' : '−') + fmt(Math.abs(run.net));
    const n = `${run.played} round${run.played === 1 ? '' : 's'}`;
    const msg = {
      done: `Autoplay finished: ${n}, ${signed}.`,
      stopped: `Autoplay stopped after ${n}, ${signed}.`,
      hidden: `Autoplay stopped while the game was hidden: ${n}, ${signed}.`,
      profit: `Profit target reached after ${n}: ${signed}.`,
      loss: `Loss limit reached after ${n}: ${signed}.`,
      bigwin: `Stopped on a big win! ${n}, ${signed}.`,
      balance: `Not enough ${esc(this.currency)} to keep going. ${n}, ${signed}.`,
    }[run.reason];
    queueMicrotask(() => this.say(msg || '')); // after the last round's own message
    this.emit('chiplets:auto', { state: 'stop', reason: run.reason, rounds: run.played, net: run.net / 100 });
    this.sync();
    this.paintBalance();
  }

  // --- money ----------------------------------------------------------------------------------------
  // The engine (browser or server) decides every round and holds the money.
  get engine() {
    return money.engine;
  }

  // A quick check before asking the engine, so an obviously impossible bet gets an instant answer.
  take(bet) {
    if (!bet) {
      this.say('Enter a bet.');
      return false;
    }
    if (bet > money.cents) {
      this.say(`Not enough ${esc(this.currency)}.`);
      this.paintBalance();
      return false;
    }
    return true;
  }

  // Explains an engine refusal or a network problem in words.
  fail(err) {
    const words = {
      balance: `Not enough ${esc(this.currency)}.`,
      busy: 'Finish the round in progress first.',
      rate: 'Easy there — a little slower.',
      auth: 'You were signed out. Refresh the page to keep playing.',
      refill: esc(err?.message || 'No refill yet.'),
      network: "Couldn't reach the server. Try again in a moment.",
    };
    this.say(words[err?.code] || esc(err?.message || 'Something went wrong.'));
  }

  async refill() {
    try {
      await money.call((e) => e.refill());
    } catch (e) {
      this.fail(e);
    }
  }

  // Reveals a round's winnings (held back while it animated) and tells the host page what happened.
  settle(game, bet, payout, multiplier, extra = {}, { held = false } = {}) {
    if (held) money.release(payout);
    const profit = payout - bet;
    const detail = {
      game,
      bet: bet / 100,
      payout: payout / 100,
      profit: profit / 100,
      multiplier,
      balance: money.cents / 100,
      currency: this.currency,
      auto: !!this.autoRun,
      engine: money.engine?.kind,
      ...extra,
    };
    const opts = { detail, bubbles: true, composed: true };
    this.dispatchEvent(new CustomEvent('chiplets:result', opts));
    this.dispatchEvent(new CustomEvent(profit > 0 ? 'chiplets:win' : 'chiplets:lose', opts));
    this.autoSettled(profit, multiplier);
    return profit;
  }
}

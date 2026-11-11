import { TILES, MINES_MIN, MINES_MAX, minesMult } from '../math/mines.js';
import { startMines, revealMines, cashoutMines, minesView } from '../rules/mines.js';

const kit = window.Chiplets && window.Chiplets.__kit;
if (!kit) throw new Error('Chiplets: load chiplets.js before the game files.');
const { ChipGame, cfg, randInt, fmt, fmtX, esc, glyph, money, rules } = kit;
rules.mines = { start: startMines, reveal: revealMines, cashout: cashoutMines, view: minesView };

const COLS = 5;

class ChipMines extends ChipGame {
  static game = 'mines';
  static css = `
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;padding:10px}
.tile{aspect-ratio:1;border:0;border-radius:11px;background:var(--chip-raised);cursor:pointer;font-size:clamp(18px,7cqi,32px);display:flex;align-items:center;justify-content:center;transition:transform .12s,background .2s,opacity .2s;box-shadow:inset 0 -3px 0 #0003;color:var(--chip-fg)}
.tile img{width:58%;height:58%;object-fit:contain}
.tile:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.15)}
.tile:disabled{cursor:default}
.tile.gem{background:color-mix(in srgb,var(--chip-win) 22%,var(--chip-panel));animation:flip .3s}
.tile.mine{background:color-mix(in srgb,var(--chip-lose) 22%,var(--chip-panel))}
.tile.hit{background:var(--chip-lose);animation:shake .4s}
.tile.dim{opacity:.45}
@keyframes flip{from{transform:rotateY(90deg)}to{transform:none}}
@keyframes shake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
`;

  build() {
    this.mines = Math.min(MINES_MAX, Math.max(MINES_MIN, +this.getAttribute('mines') || 3));
    this.gem = this.getAttribute('gem') || '💎';
    this.bomb = this.getAttribute('bomb') || '💣';
    const mineOpts = Array.from({ length: MINES_MAX - MINES_MIN + 1 }, (_, i) => i + MINES_MIN)
      .map((n) => `<option${n === this.mines ? ' selected' : ''}>${n}</option>`)
      .join('');
    this.shell(
      'Mines',
      `<div class="grid">${Array.from({ length: TILES }, (_, i) => `<button class="tile" type="button" data-i="${i}" aria-label="Tile ${i + 1}" disabled></button>`).join('')}</div>`,
      `<div class="controls">${this.betField()}<button class="go" type="button">Start</button></div>
       <div class="row"><div class="field" style="flex:1"><label>Mines</label><select class="mines">${mineOpts}</select></div></div>`,
      `<div class="stat"><span>Next tile <b class="nx">—</b></span><span>Cash out <b class="co">—</b></span></div>`,
      { tools: `<button class="pill" type="button" data-tool="random" disabled title="Reveal a random tile">🎲 Random tile</button>` },
    );
    this.bindPrimary(() => (this.game ? this.cashout() : !this.cooling && this.start()));
    this.$('.mines').addEventListener('change', (e) => {
      this.mines = +e.target.value;
      this.paintStats();
    });
    this.$$('.tile').forEach((t) => t.addEventListener('click', () => this.reveal(+t.dataset.i)));
    this.$('[data-tool=random]').addEventListener('click', () => this.revealRandom());
    this.say('Find gems, dodge mines, cash out any time.');
    this.paintStats();
    this.resume();
  }

  // Payout after k safe tiles, for the round in progress (or the picker when idle).
  mult(k) {
    return minesMult(k, this.game ? this.game.mines : this.mines, cfg.rtp);
  }

  // An unfinished round picks up where it left off — after a reload, or (signed in) on another device.
  async resume() {
    const eng = money.engine;
    let view = null;
    try {
      view = await eng.mines.active();
    } catch (e) {}
    if (!view || this.game || money.engine !== eng) return;
    this.game = { ...view, eng };
    this.$('.mines').value = view.mines;
    this.clearBoard();
    view.open.forEach((i) => this.paintTile(i, 'gem'));
    this.say('Round resumed.');
    this.sync();
    this.paintStats();
  }

  // Signed in or out: show that engine's round, unless one is still being played here.
  engineChanged() {
    if (this.game || this.asking) return;
    this.clearBoard(true);
    this.resume();
  }

  clearBoard(disabled = false) {
    this.$$('.tile').forEach((t, i) => {
      t.className = 'tile';
      t.innerHTML = '';
      t.disabled = disabled;
      t.setAttribute('aria-label', `Tile ${i + 1}`);
    });
  }

  syncGame() {
    const live = !!this.game;
    const go = this.$('.go');
    go.textContent = live ? (this.game.open.length ? `Cash out ${fmt(Math.floor(this.game.bet * this.mult(this.game.open.length)))}` : 'Pick a tile') : 'Start';
    go.classList.toggle('cash', live && this.game.open.length > 0);
    go.disabled = !!this.asking || (live && !this.game.open.length) || (!live && this.cooling);
    this.$('.mines').disabled = live;
    this.$('.bet').disabled = live;
    this.$('[data-tool=random]').disabled = !live || !!this.asking;
    this.$$('.tile').forEach((t) => {
      if (!t.classList.contains('gem')) t.disabled = !live || !!this.asking;
    });
  }

  paintStats() {
    const k = this.game ? this.game.open.length : 0;
    const max = TILES - (this.game ? this.game.mines : this.mines);
    this.$('.nx').textContent = k < max ? fmtX(this.mult(k + 1)) : '—';
    this.$('.co').textContent = k ? fmtX(this.mult(k)) : '—';
  }

  paintTile(i, kind, cls = '') {
    const t = this.$(`.tile[data-i="${i}"]`);
    t.className = `tile ${kind} ${cls}`;
    t.innerHTML = glyph(kind === 'gem' ? this.gem : this.bomb);
    t.setAttribute('aria-label', `Tile ${i + 1}: ${kind === 'gem' ? 'gem' : 'mine'}`);
    t.disabled = true;
  }

  // Arrow keys move between tiles; Space/Enter on a tile reveals it (it's a button).
  onKey(e, t) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (step === undefined || !t.classList?.contains('tile')) return false;
    let j = +t.dataset.i;
    const row = Math.floor(j / COLS);
    for (;;) {
      j += step;
      if (j < 0 || j >= TILES || (Math.abs(step) === 1 && Math.floor(j / COLS) !== row)) break;
      const next = this.$(`.tile[data-i="${j}"]`);
      if (!next.disabled) {
        next.focus();
        break;
      }
    }
    return true;
  }

  // Asks the engine, with the board locked so nothing gets clicked twice meanwhile.
  async ask(fn, eng) {
    this.asking = true;
    this.sync();
    try {
      return await money.call(fn, { engine: eng });
    } finally {
      this.asking = false;
      this.sync();
    }
  }

  async start() {
    const bet = this.betCents();
    if (this.asking || !this.take(bet)) return false;
    const eng = money.engine;
    let res;
    try {
      res = await this.ask((e) => e.mines.start({ bet, mines: this.mines }), eng);
    } catch (err) {
      this.fail(err);
      if (err.code === 'busy') this.resume();
      return false;
    }
    this.game = { ...res.round, eng };
    this.clearBoard();
    this.say(`${this.game.mines} mine${this.game.mines > 1 ? 's' : ''} hidden. Pick a tile.`);
    this.sfx('tick');
    this.sync();
    this.paintStats();
    this.paintBalance();
    return true;
  }

  revealRandom() {
    if (!this.game || this.asking) return;
    const open = this.$$('.tile').filter((t) => !t.disabled).map((t) => +t.dataset.i);
    if (open.length) this.reveal(open[randInt(open.length)]);
  }

  async reveal(i) {
    const g = this.game;
    if (!g || g.open.includes(i) || this.asking) return;
    let res;
    try {
      res = await this.ask((e) => e.mines.reveal(i), g.eng);
    } catch (err) {
      return this.fail(err);
    }
    if (this.game !== g) return;
    if (!res.gem) return this.end(g, res, i);
    g.open = res.open || [...g.open, i];
    this.paintTile(i, 'gem');
    const at = this.fxPoint(this.$(`.tile[data-i="${i}"]`));
    this.sfx('gem', { k: g.open.length });
    this.buzz(8);
    this.fx.sparkle(at.x, at.y, '#a7f3d0');
    if (res.done) return this.end(g, res);
    this.say(`${fmtX(res.multiplier)} — keep going or cash out.`);
    this.sync();
    this.paintStats();
  }

  async cashout() {
    const g = this.game;
    if (!g || !g.open.length || this.asking) return;
    let res;
    try {
      res = await this.ask((e) => e.mines.cashout(), g.eng);
    } catch (err) {
      return this.fail(err);
    }
    if (this.game === g) this.end(g, res);
  }

  end(g, res, hit) {
    this.game = null;
    const won = !!res.won;
    const k = (res.open || g.open).length;
    (res.bombs || []).forEach((b) => this.paintTile(b, 'mine', b === hit ? 'hit' : 'dim'));
    this.$$('.tile').forEach((t) => {
      if (!t.classList.contains('gem') && !t.classList.contains('mine')) {
        t.disabled = true;
        t.classList.add('dim');
      }
    });
    this.cooldown();
    const profit = this.settle('mines', g.bet, res.payout, won ? res.multiplier : 0, { mines: g.mines, revealed: k });
    if (won) {
      this.celebrate(res.multiplier, profit, undefined, 'cash');
      this.say(`<b class="win">Cashed out ${fmtX(res.multiplier)}</b> · +${fmt(profit)} ${esc(this.currency)}`);
    } else {
      const at = this.fxPoint(this.$(`.tile[data-i="${hit}"]`));
      this.sfx('boom');
      this.buzz([60, 30, 120]);
      this.fx.burst(at.x, at.y);
      this.fx.shake();
      this.say(`<b class="lose">Boom.</b> −${fmt(g.bet)} ${esc(this.currency)}`);
    }
    this.sync();
    this.paintStats();
    this.paintBalance();
  }
}

if (!customElements.get('chip-mines')) customElements.define('chip-mines', ChipMines);

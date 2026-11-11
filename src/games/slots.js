import { SLOT_BASE, STOPS, slotPays, buildStrip } from '../math/slots.js';
import { playSlots } from '../rules/slots.js';

const kit = window.Chiplets && window.Chiplets.__kit;
if (!kit) throw new Error('Chiplets: load chiplets.js before the game files.');
const { ChipGame, cfg, randInt, fmt, fmtX, esc, glyph, reducedMotion, money, rules } = kit;
rules.slots = { play: playSlots };

const REPEAT = 7; // copies of the strip stacked in each reel, so a spin can travel several laps

class ChipSlots extends ChipGame {
  static game = 'slots';
  static css = `
.reels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px;position:relative}
.reel{height:calc(var(--cell) * 3);overflow:hidden;border-radius:12px;background:linear-gradient(var(--chip-raised),var(--chip-panel) 30%,var(--chip-panel) 70%,var(--chip-raised));position:relative;transition:box-shadow .2s}
.reel.suspense{box-shadow:inset 0 0 0 2px var(--chip-gold),0 0 26px -6px var(--chip-gold);animation:sus .45s ease-in-out infinite alternate}
@keyframes sus{to{box-shadow:inset 0 0 0 2px var(--chip-gold),0 0 36px -2px var(--chip-gold)}}
.strip{will-change:transform}
.cell{height:var(--cell);display:flex;align-items:center;justify-content:center;font-size:calc(var(--cell) * .55);line-height:1}
.cell img{width:62%;height:62%;object-fit:contain}
.cell.win{animation:bump .7s cubic-bezier(.2,1.6,.4,1)}
@keyframes bump{40%{transform:scale(1.24)}}
.payline{position:absolute;left:4px;right:4px;top:calc(10px + var(--cell));height:var(--cell);border:2px solid var(--chip-accent);border-radius:12px;pointer-events:none;opacity:.55;transition:opacity .2s,border-color .2s,box-shadow .2s}
.payline.hit{opacity:1;border-color:var(--chip-win);box-shadow:0 0 24px -2px var(--chip-win);animation:line 1.1s ease-in-out 2}
@keyframes line{50%{box-shadow:0 0 40px 4px var(--chip-win)}}
.pay{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
.pay div{display:flex;align-items:center;gap:6px;background:var(--chip-panel);border:1px solid var(--chip-line);border-radius:10px;padding:6px 8px;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.pay .g{font-size:15px;letter-spacing:-2px} .pay .g img{width:15px;height:15px;object-fit:contain;margin-right:2px}
.pay .x{margin-left:auto;color:var(--chip-gold)}
@container (max-width:380px){.pay{grid-template-columns:repeat(2,1fr)}}
`;

  build() {
    const custom = (this.getAttribute('symbols') || '').split(',').map((s) => s.trim()).filter(Boolean);
    this.syms = SLOT_BASE.map((s, i) => ({ ...s, g: custom[i] || s.g }));
    this.pays = slotPays(cfg.rtp, this.syms);
    this.strip = buildStrip(this.syms);

    const cells = Array.from({ length: REPEAT }, () => this.strip.map((i) => `<div class="cell">${glyph(this.syms[i].g)}</div>`).join('')).join('');
    const paytable = this.syms
      .map((s, i) => ({ s, x: this.pays[i] }))
      .reverse()
      .map(({ s, x }) => `<div><span class="g">${glyph(s.g).repeat(3)}</span><span class="x">${fmtX(x)}</span></div>`)
      .join('');
    this.shell(
      'Slots',
      `<div class="reels">${[0, 1, 2].map(() => `<div class="reel"><div class="strip">${cells}</div></div>`).join('')}<div class="payline"></div></div>`,
      `<div class="controls">${this.betField()}<button class="go" type="button">Spin</button></div>`,
      `<div class="pay">${paytable}</div>`,
      { turbo: true, auto: true },
    );
    this.pos = [0, 1, 2].map(() => randInt(STOPS));
    this.bindPrimary(() => this.spin());
    this.layout();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.$('.reels'));
    this.say('Three of a kind on the line wins.');
  }

  layout() {
    const w = this.$('.reel').clientWidth || 100;
    this.cell = Math.max(48, Math.min(96, Math.round(w * 0.62)));
    this.$('.reels').style.setProperty('--cell', this.cell + 'px');
    if (this.busy) return; // don't yank the reels mid-spin
    this.$$('.strip').forEach((s, r) => {
      s.style.transition = 'none';
      s.style.transform = `translateY(${-(this.pos[r] - 1 + STOPS) * this.cell}px)`;
    });
  }

  syncGame() {
    this.$('.go').disabled = !!this.busy;
  }

  autoStep() {
    return this.spin();
  }
  autoGap() {
    return this.fast ? 160 : 520;
  }

  async spin() {
    if (this.busy) return false;
    const bet = this.betCents();
    if (!this.take(bet)) return false;
    this.busy = true;
    this.paintBalance();
    this.$('.payline').classList.remove('hit');
    this.$$('.cell.win').forEach((c) => c.classList.remove('win'));
    this.say('Spinning…');

    // The engine (browser or server) decides where the reels stop; the winnings stay hidden until they do.
    let res;
    try {
      res = await money.call((e) => e.play('slots', { bet }), { hold: true });
    } catch (err) {
      this.busy = false;
      this.fail(err);
      this.sync();
      this.paintBalance();
      return false;
    }
    const stops = res.stops;
    const rm = reducedMotion();
    // When the first two reels match, the last one takes its time. It still lands exactly where the
    // random draw above put it — the suspense is decoration, never a fake near-miss.
    const suspense = !rm && this.strip[stops[0]] === this.strip[stops[1]];
    const base = this.fast ? [380, 540, 700] : [1100, 1520, 1940];
    const dur = rm ? [220, 220, 220] : base.map((d, r) => (r === 2 && suspense ? d + (this.fast ? 650 : 1500) : d));

    const strips = this.$$('.strip');
    strips.forEach((s, r) => {
      s.style.transition = 'none';
      s.style.transform = `translateY(${-(this.pos[r] - 1 + STOPS) * this.cell}px)`;
    });
    void strips[0].offsetHeight; // commit the start position before animating
    strips.forEach((s, r) => {
      const laps = 3 + r + (r === 2 && suspense ? 1 : 0);
      const ease = r === 2 && suspense ? 'cubic-bezier(.1,.72,.06,1)' : 'cubic-bezier(.16,.84,.3,1.04)';
      s.style.transition = `transform ${dur[r]}ms ${ease}`;
      s.style.transform = `translateY(${-(STOPS * laps + stops[r] - 1) * this.cell}px)`;
    });

    clearInterval(this._tick);
    if (!rm) this._tick = setInterval(() => this.sfx('tick'), this.fast ? 55 : 80);
    this._t = dur.map((d, r) =>
      setTimeout(() => {
        this.sfx('reel');
        this.buzz(8);
        if (r === 1 && suspense) {
          this.$$('.reel')[2].classList.add('suspense');
          this.sfx('riser', { dur: (dur[2] - dur[1]) / 1000 });
        }
        if (r === 2) clearInterval(this._tick);
      }, d),
    );
    setTimeout(() => this.finish(bet, res), Math.max(...dur) + 60);
    return true;
  }

  finish(bet, res) {
    const stops = res.stops;
    this.pos = stops;
    this.busy = false;
    this.layout();
    this.$$('.reel').forEach((r) => r.classList.remove('suspense'));
    const { won, multiplier: mult, payout } = res;
    const profit = this.settle('slots', bet, payout, mult, { symbols: res.symbols.map((i) => this.syms[i].g) }, { held: true });
    if (won) {
      this.$('.payline').classList.add('hit');
      this.$$('.strip').forEach((s, r) => s.children[STOPS + stops[r]]?.classList.add('win'));
      this.celebrate(mult, profit, this.fxPoint(this.$('.payline')));
      this.say(`<b class="win">${fmtX(mult)}!</b> You won ${fmt(payout)} ${esc(this.currency)}.`);
    } else this.say(`No match. <b class="lose">−${fmt(bet)}</b>`);
    this.sync();
    this.paintBalance();
  }

  unmounted() {
    clearInterval(this._tick);
  }
}

if (!customElements.get('chip-slots')) customElements.define('chip-slots', ChipSlots);

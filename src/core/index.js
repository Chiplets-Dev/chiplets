/* Chiplets core: settings, the engine (who decides rounds and holds the money), the base game class and
 * the on-demand game loader. Game files read everything they need from window.Chiplets.__kit, so there is
 * only ever one wallet. */
import { cfg, readScriptConfig } from './config.js';
import { rand, randInt, fmt, fmtX, esc, glyph, isImg, makeSheet } from './util.js';
import { wallet, bus } from './wallet.js';
import { ChipGame } from './base.js';
import { money, rules, connect, localEngine } from './engine.js';
import { RuleError } from '../rules/common.js';
import { createLoader } from './loader.js';
import { sound, haptic } from './sound.js';
import { prefs, reducedMotion } from './prefs.js';
import { plinkoTable } from '../math/plinko.js';
import { minesMult, TILES } from '../math/mines.js';

const VERSION = __VERSION__;
const GAMES = __GAMES__;

if (window.Chiplets && window.Chiplets.version) {
  console.warn(`Chiplets ${window.Chiplets.version} is already on this page; ignoring a second copy.`);
} else {
  const script = document.currentScript || [...document.scripts].find((s) => /chiplets(\.all)?\.js(\?|$)/.test(s.src));
  readScriptConfig(script);
  const base = script?.dataset.base || (script?.src ? new URL('.', script.src).href : new URL('/v1/', location.href).href);
  const loader = createLoader(base, GAMES);

  // Reserve about the right amount of room while a game's file loads, so the page doesn't jump.
  // Heights measured at 300–560px wide: roughly a fixed part plus a share of the width.
  const HOLD = { slots: [518, 17.7], plinko: [346, 67.1], mines: [367, 81], crash: [368, 40.2] };
  const hold = document.createElement('style');
  hold.textContent = GAMES.map((g) => {
    const [px, pct] = HOLD[g] || [420, 0];
    return `chip-${g}:not(:defined){display:block;max-width:560px;border-radius:18px;background:rgba(127,127,127,.07);padding-bottom:${px}px}chip-${g}:not(:defined)::before{content:"";display:block;padding-top:${pct}%}`;
  }).join('');
  (document.head || document.documentElement).append(hold);

  window.Chiplets = {
    version: VERSION,
    games: [...GAMES],
    config(o = {}) {
      Object.assign(cfg, o);
      wallet.reload();
      return { ...cfg };
    },
    get settings() {
      return { ...cfg };
    },
    load: (name) => loader.load(name),
    // Swap the engine that decides rounds (e.g. a server for signed-in players). Chiplets.connect() alone
    // goes back to the built-in one.
    connect: (engine) => connect(engine || localEngine),
    get engine() {
      return money.engine?.kind;
    },
    sound: {
      get muted() {
        return sound.muted;
      },
      set muted(v) {
        sound.muted = v;
      },
      toggle: () => sound.toggle(),
    },
    // give / take / reset change the built-in (guest) wallet only; a connected engine guards its own money.
    wallet: {
      get balance() {
        return money.cents / 100;
      },
      give(amount) {
        if (money.engine !== localEngine) return false;
        wallet.credit(Math.round(amount * 100));
        return true;
      },
      take(amount) {
        return money.engine === localEngine && wallet.debit(Math.round(amount * 100));
      },
      refill: () => money.call((e) => e.refill()).then((r) => r.balance / 100),
      reset() {
        if (money.engine === localEngine) wallet.reset();
      },
      stats() {
        const s = wallet.stats();
        return { balance: s.c / 100, played: s.played, wagered: s.wagered / 100, returned: s.returned / 100, refills: s.refills };
      },
    },
    odds: {
      plinko(rows, risk) {
        const t = plinkoTable(rows, risk, cfg.rtp);
        return { multipliers: [...t.m], rtp: t.rtp };
      },
      mines: (mines) => Array.from({ length: TILES - mines }, (_, k) => minesMult(k + 1, mines, cfg.rtp)),
    },
    // For game files only. Bump `api` if this shape ever changes incompatibly.
    __kit: { api: 1, version: VERSION, cfg, rand, randInt, fmt, fmtX, esc, glyph, isImg, makeSheet, bus, prefs, sound, haptic, reducedMotion, ChipGame, money, rules, RuleError },
  };
  connect(localEngine);

  // Deferred a tick so a bundle that ships the games in the same file defines them first.
  queueMicrotask(() => {
    loader.start();
    document.dispatchEvent(new CustomEvent('chiplets:ready', { detail: { version: VERSION } }));
  });
}

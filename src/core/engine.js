import { cfg } from './config.js';
import { wallet, bus, onWalletChange } from './wallet.js';
import { rand, randInt } from './util.js';
import { RuleError, checkBet } from '../rules/common.js';

// The engine decides every outcome and holds the money; games only animate its answers.
// The built-in engine runs in the browser (guests, and every site that doesn't connect its own).
// A site can swap in another — chiplets.win connects its server for signed-in players — with
// Chiplets.connect(engine). Every engine call resolves to an answer that includes the new `balance`.
//
// Winnings are held back from the balance players see until the game's animation reveals them
// (money.release), so a slow ball or a spinning reel never gives the result away.

export const rules = {}; // filled in by the game files: rules.slots = { play }, rules.mines = { start, … }

const state = { engine: null, balance: 0, held: 0, quiet: false };

function announce() {
  const cents = Math.max(0, state.balance - state.held);
  bus.dispatchEvent(new CustomEvent('balance', { detail: { cents } }));
  document.dispatchEvent(new CustomEvent('chiplets:balance', { detail: { balance: cents / 100, cents } }));
}

export const money = {
  // What players see: the engine's balance minus winnings not revealed yet.
  get cents() {
    return Math.max(0, state.balance - state.held);
  },
  get engine() {
    return state.engine;
  },
  // Runs fn(engine) and takes the new balance from its answer. Pass `engine` to talk to the one a round
  // started on (it may have been swapped since); `hold: true` holds back the answer's payout.
  async call(fn, { engine = state.engine, hold = false } = {}) {
    state.quiet = engine === localEngine; // the local wallet changes inside the call; announce once, below
    let res;
    try {
      const p = fn(engine);
      state.quiet = false;
      res = await p;
    } finally {
      state.quiet = false;
    }
    if (engine === state.engine && res && Number.isInteger(res.balance)) state.balance = res.balance;
    if (engine === state.engine && hold && res?.payout > 0) state.held += res.payout;
    announce();
    return res;
  },
  release(cents) {
    if (!(cents > 0)) return;
    state.held = Math.max(0, state.held - cents);
    announce();
  },
};

export function connect(engine) {
  if (!engine || typeof engine.play !== 'function') throw new TypeError('Chiplets.connect() needs an engine');
  state.engine = engine;
  state.balance = Number.isInteger(engine.balance) ? engine.balance : 0;
  state.held = 0;
  engine.subscribe?.((cents) => {
    if (state.engine !== engine) return;
    state.balance = cents;
    announce();
  });
  bus.dispatchEvent(new CustomEvent('engine', { detail: { kind: engine.kind } }));
  announce();
}

// --- the built-in engine ------------------------------------------------------------------------------
const ctx = () => ({ rand, randInt, rtp: cfg.rtp, now: performance.now() });
const maxBet = () => Math.round(cfg.maxBet * 100);
const stake = (bet) => {
  checkBet(bet, wallet.cents, maxBet());
  if (!wallet.debit(bet)) throw new RuleError('balance', 'Not enough chips.');
};
const pay = (cents) => cents > 0 && wallet.credit(cents);
const need = (game, fn) => {
  const r = rules[game];
  if (!r || !r[fn]) throw new RuleError('game', `Load the ${game} game first.`);
  return r;
};

const minesKey = () => `chiplets:${cfg.storage}:mines`;
function loadMines() {
  try {
    const g = JSON.parse(localStorage.getItem(minesKey()));
    if (g && Array.isArray(g.bombs) && Array.isArray(g.open) && g.bet > 0) return { mines: g.bombs.length, ...g };
  } catch (e) {}
  return null;
}
function saveMines(g) {
  try {
    g ? localStorage.setItem(minesKey(), JSON.stringify(g)) : localStorage.removeItem(minesKey());
  } catch (e) {}
}

let crash = null; // { round, result, waiters, timer }

function finishCrash(res) {
  crash.result = res;
  clearTimeout(crash.timer);
  pay(res.payout);
  const answer = { ended: true, ...res, balance: wallet.cents };
  crash.waiters.forEach((w) => w(answer));
  crash.waiters.clear();
  return answer;
}

export const localEngine = {
  kind: 'local',
  get balance() {
    return wallet.cents;
  },
  // Single-request games (slots, plinko). The outcome is drawn first so a bad request never costs a bet.
  async play(game, req) {
    const out = need(game, 'play').play(req, ctx());
    stake(req.bet);
    pay(out.payout);
    return { ...out, balance: wallet.cents };
  },
  mines: {
    async active() {
      return rules.mines?.view(loadMines()) ?? null;
    },
    async start(req) {
      if (loadMines()) throw new RuleError('busy', 'Finish the round in progress first.');
      const round = need('mines', 'start').start(req, ctx());
      stake(req.bet);
      saveMines(round);
      return { round: rules.mines.view(round), balance: wallet.cents };
    },
    async reveal(tile) {
      const round = loadMines();
      if (!round) throw new RuleError('none', 'No round in progress.');
      const res = rules.mines.reveal(round, tile, ctx());
      if (res.done) {
        saveMines(null);
        pay(res.payout);
      } else saveMines(round);
      return { ...res, balance: wallet.cents };
    },
    async cashout() {
      const round = loadMines();
      if (!round) throw new RuleError('none', 'No round in progress.');
      const res = rules.mines.cashout(round, ctx());
      saveMines(null);
      pay(res.payout);
      return { ...res, balance: wallet.cents };
    },
  },
  crash: {
    async start(req) {
      if (crash && !crash.result) throw new RuleError('busy', 'Finish the round in progress first.');
      const r = need('crash', 'start');
      const round = r.start(req, ctx());
      stake(req.bet);
      crash = { round, result: null, waiters: new Set(), timer: 0 };
      const settle = () => {
        if (!crash || crash.round !== round || crash.result) return;
        const res = r.settle(round, performance.now());
        if (res) finishCrash(res);
        else crash.timer = setTimeout(settle, 30); // woke a little early
      };
      crash.timer = setTimeout(settle, Math.max(0, r.end(round).at - performance.now()));
      return { auto: round.auto, elapsed: 0, balance: wallet.cents };
    },
    async cashout() {
      if (!crash || crash.result) throw new RuleError('none', 'No round in progress.');
      return finishCrash(rules.crash.cashout(crash.round, performance.now()));
    },
    async active() {
      return crash && !crash.result ? { bet: crash.round.bet, auto: crash.round.auto, elapsed: performance.now() - crash.round.t0 } : null;
    },
    // Resolves when the round ends (by itself or by a cash-out).
    watch() {
      if (!crash) return Promise.resolve({ ended: true, none: true, balance: wallet.cents });
      if (crash.result) return Promise.resolve({ ended: true, ...crash.result, balance: wallet.cents });
      return new Promise((resolve) => crash.waiters.add(resolve));
    },
  },
  async refill() {
    wallet.refill();
    return { balance: wallet.cents };
  },
};

// Guest wallet changes made outside a round (another tab, Chiplets.wallet.give, refill, reset).
onWalletChange(() => {
  if (state.engine !== localEngine || state.quiet) return;
  state.balance = wallet.cents;
  announce();
});

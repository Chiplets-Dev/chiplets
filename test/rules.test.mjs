// The round rules both the browser and the server run. Run: npm run test:math
import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleError, checkBet } from '../src/rules/common.js';
import { playSlots } from '../src/rules/slots.js';
import { playPlinko } from '../src/rules/plinko.js';
import { startMines, revealMines, cashoutMines, minesView } from '../src/rules/mines.js';
import { startCrash, crashEnd, crashSettle, cashoutCrash } from '../src/rules/crash.js';
import { msFor } from '../src/math/crash.js';

const RTP = 0.99;
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctxFor = (seed) => {
  const rand = mulberry32(seed);
  return { rand, randInt: (n) => Math.floor(rand() * n), rtp: RTP };
};
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof RuleError && e.code === code);

test('bets: whole cents, within the limit, within the balance', () => {
  throwsCode(() => checkBet(0, 100), 'bet');
  throwsCode(() => checkBet(1.5, 100), 'bet');
  throwsCode(() => checkBet(101, 100), 'balance');
  throwsCode(() => checkBet(500, 10_000, 400), 'bet');
  checkBet(100, 100);
});

test('slots: a long simulated session returns about 99%', () => {
  const ctx = ctxFor(1);
  let bet = 0, back = 0;
  for (let i = 0; i < 400_000; i++) {
    const r = playSlots({ bet: 100 }, ctx);
    bet += 100;
    back += r.payout;
    assert.equal(r.won, r.payout > 0);
  }
  assert.ok(Math.abs(back / bet - RTP) < 0.02, `returned ${(back / bet).toFixed(4)}`);
});

test('plinko: validates the board and returns about 99%', () => {
  const ctx = ctxFor(2);
  throwsCode(() => playPlinko({ bet: 100, rows: 7, risk: 'low' }, ctx), 'rows');
  throwsCode(() => playPlinko({ bet: 100, rows: 12, risk: 'wild' }, ctx), 'risk');
  for (const risk of ['low', 'medium', 'high']) {
    let back = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) back += playPlinko({ bet: 10_000, rows: 12, risk }, ctx).payout;
    assert.ok(Math.abs(back / (N * 10_000) - RTP) < 0.02, `${risk} returned ${(back / (N * 10_000)).toFixed(4)}`);
  }
});

test('mines: the round state machine', () => {
  const ctx = ctxFor(3);
  throwsCode(() => startMines({ bet: 100, mines: 0 }, ctx), 'mines');
  const round = startMines({ bet: 100, mines: 3 }, ctx);
  assert.deepEqual(minesView(round), { bet: 100, mines: 3, open: [] }, 'the view hides the bombs');
  throwsCode(() => cashoutMines(round, ctx), 'empty');
  const safe = [...Array(25).keys()].filter((t) => !round.bombs.includes(t));
  const a = revealMines(round, safe[0], ctx);
  assert.equal(a.gem, true);
  assert.equal(a.done, false);
  assert.equal(a.bombs, undefined, 'bombs stay hidden mid-round');
  throwsCode(() => revealMines(round, safe[0], ctx), 'tile');
  throwsCode(() => revealMines(round, 25, ctx), 'tile');
  const out = cashoutMines(round, ctx);
  assert.equal(out.won, true);
  assert.equal(out.payout, Math.floor(100 * out.multiplier));
  assert.deepEqual(out.bombs.sort(), [...round.bombs].sort());
  const boom = revealMines(startMines({ bet: 100, mines: 24 }, ctx), 0, ctx);
  assert.ok(boom.done && (boom.won ? boom.payout > 0 : boom.payout === 0));
});

test('mines: clearing the whole board ends the round as a win', () => {
  const ctx = ctxFor(4);
  const round = startMines({ bet: 100, mines: 20 }, ctx);
  const safe = [...Array(25).keys()].filter((t) => !round.bombs.includes(t));
  let last;
  for (const t of safe) last = revealMines(round, t, ctx);
  assert.ok(last.done && last.won && last.payout > 100);
});

test('crash: auto cash-out, crash and late cash-outs resolve on the clock', () => {
  const ctx = { ...ctxFor(5), now: 1000 };
  throwsCode(() => startCrash({ bet: 100, auto: 1 }, ctx), 'auto');
  // a round that crashes at 1.50× and one with auto cash-out at 1.20×
  const r = { bet: 100, auto: null, cp: 1.5, t0: 1000 };
  assert.equal(crashSettle(r, 1000 + msFor(1.5) - 1), null, 'still going just before the crash');
  assert.deepEqual(crashSettle(r, 1000 + msFor(1.5)), { done: true, won: false, multiplier: 0, payout: 0, cp: 1.5 });
  const early = cashoutCrash(r, 1000 + msFor(1.25));
  assert.equal(early.won, true);
  assert.ok(early.multiplier >= 1.24 && early.multiplier <= 1.25, `${early.multiplier}`);
  assert.equal(cashoutCrash(r, 1000 + msFor(1.6)).won, false, 'cashing out after the crash loses');
  const a = { bet: 100, auto: 1.2, cp: 1.5, t0: 1000 };
  assert.deepEqual(crashEnd(a), { at: 1000 + msFor(1.2), won: true, multiplier: 1.2 });
  assert.equal(cashoutCrash(a, 1000 + msFor(1.4)).multiplier, 1.2, 'the auto cash-out already happened');
  const b = { bet: 100, auto: 2, cp: 1.5, t0: 1000 };
  assert.equal(crashEnd(b).won, false, 'auto above the crash point loses');
  const instant = { bet: 100, auto: null, cp: 1, t0: 1000 };
  assert.equal(crashSettle(instant, 1000).won, false, 'a 1.00× crash ends at once');
});

test('crash: auto cash-out targets return about 99%', () => {
  const ctx = { ...ctxFor(6), now: 0 };
  for (const auto of [1.5, 2, 10]) {
    let back = 0;
    const N = 300_000;
    for (let i = 0; i < N; i++) {
      const r = startCrash({ bet: 100, auto }, ctx);
      back += crashSettle(r, Infinity).payout;
    }
    assert.ok(Math.abs(back / (N * 100) - RTP) < 0.015, `auto ${auto} returned ${(back / (N * 100)).toFixed(4)}`);
  }
});

// --- free chips ---------------------------------------------------------------------------------------
import { DAILY, DAILY_GAP, STREAK_GRACE, CHEST_EVERY, CHEST_MIN, CHEST_MAX, dailyStatus, claimDaily, chestStatus, openChest } from '../src/rules/bonus.js';
const H = 3600e3;

test('daily bonus: day 1, then 20 hours until the next', () => {
  assert.deepEqual(dailyStatus(null, 0).day, 1);
  const a = claimDaily(null, 1000);
  assert.equal(a.amount, DAILY[0]);
  const st = dailyStatus(a.state, 1000 + 19 * H);
  assert.equal(st.claimable, false);
  assert.equal(st.nextAt, 1000 + DAILY_GAP);
  throwsCode(() => claimDaily(a.state, 1000 + 19 * H), 'bonus');
});

test('daily bonus: a streak climbs to day 7 and stays there', () => {
  let s = null, t = 0;
  const got = [];
  for (let i = 0; i < 9; i++) {
    const r = claimDaily(s, t);
    got.push(r.amount);
    s = r.state;
    t += 24 * H;
  }
  assert.deepEqual(got, [...DAILY, DAILY[6], DAILY[6]]);
});

test('daily bonus: more than 48 hours between claims starts over', () => {
  const a = claimDaily(claimDaily(null, 0).state, 24 * H); // day 2
  assert.equal(a.day, 2);
  const late = dailyStatus(a.state, 24 * H + STREAK_GRACE + 1);
  assert.ok(late.broken && late.day === 1 && late.amount === DAILY[0]);
  const ok = dailyStatus(a.state, 24 * H + STREAK_GRACE - 1);
  assert.ok(!ok.broken && ok.day === 3);
});

test('chest: 25–100 whole chips, then 4 hours to refill', () => {
  const r = mulberry32(9);
  const randInt = (n) => Math.floor(r() * n);
  const seen = new Set();
  let s = null, t = 0;
  for (let i = 0; i < 500; i++) {
    const o = openChest(s, t, randInt);
    assert.ok(o.amount >= CHEST_MIN && o.amount <= CHEST_MAX && o.amount % 100 === 0, `${o.amount}`);
    seen.add(o.amount);
    throwsCode(() => openChest(o.state, t + CHEST_EVERY - 1, randInt), 'bonus');
    assert.equal(chestStatus(o.state, t + CHEST_EVERY).claimable, true);
    s = o.state;
    t += CHEST_EVERY;
  }
  assert.ok(seen.has(CHEST_MIN) && seen.has(CHEST_MAX), 'both ends reachable');
});

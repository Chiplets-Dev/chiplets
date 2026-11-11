// Proves every game pays back what the docs say. Run: npm run test:math
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_BASE, STOPS, slotPays, slotsRtp, buildStrip, slotsResult } from '../src/math/slots.js';
import { plinkoTable, binom, plinkoDrop, ROWS_MIN, ROWS_MAX, RISKS } from '../src/math/plinko.js';
import { TILES, MINES_MIN, MINES_MAX, survive, minesMult, placeMines } from '../src/math/mines.js';
import { crashPoint, multAt, msFor, CRASH_CAP } from '../src/math/crash.js';

const RTP = 0.99;

// Deterministic PRNG so Monte Carlo checks give the same answer every run.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('slots: weights fill the 64-stop strip exactly', () => {
  assert.equal(SLOT_BASE.reduce((a, s) => a + s.w, 0), STOPS);
  const strip = buildStrip();
  assert.equal(strip.length, STOPS);
  SLOT_BASE.forEach((s, i) => assert.equal(strip.filter((x) => x === i).length, s.w, `symbol ${s.g}`));
  assert.deepEqual(buildStrip(), strip, 'strip order is stable between visits');
});

test('slots: expected return is exactly 99%', () => {
  assert.ok(Math.abs(slotsRtp(slotPays(RTP)) - RTP) < 1e-12);
});

test('slots: brute force over all 64³ outcomes agrees', () => {
  const strip = buildStrip();
  const pays = slotPays(RTP);
  let total = 0;
  for (let a = 0; a < STOPS; a++) for (let b = 0; b < STOPS; b++) for (let c = 0; c < STOPS; c++) total += slotsResult([a, b, c], strip, pays).mult;
  assert.ok(Math.abs(total / STOPS ** 3 - RTP) < 1e-12);
});

test('plinko: every rows × risk table returns between 98.5% and 99%', () => {
  for (const risk of RISKS)
    for (let n = ROWS_MIN; n <= ROWS_MAX; n++) {
      const t = plinkoTable(n, risk, RTP);
      assert.equal(t.m.length, n + 1);
      assert.ok(t.rtp <= RTP + 1e-9, `${risk}/${n} returns ${t.rtp}`);
      assert.ok(t.rtp >= 0.985, `${risk}/${n} returns only ${t.rtp}`);
      const p = binom(n);
      assert.ok(Math.abs(p.reduce((a, v) => a + v, 0) - 1) < 1e-12);
      for (let k = 0; k <= n; k++) assert.equal(t.m[k], t.m[n - k], `${risk}/${n} is symmetric`);
      assert.ok(t.m[0] > t.m[Math.floor(n / 2)], `${risk}/${n} edges beat the middle`);
    }
});

test('plinko: riskier tables have bigger edges', () => {
  for (let n = ROWS_MIN; n <= ROWS_MAX; n++) {
    const [lo, md, hi] = RISKS.map((r) => plinkoTable(n, r, RTP).m[0]);
    assert.ok(lo < md && md < hi, `rows ${n}: ${lo} < ${md} < ${hi}`);
  }
});

test('plinko: simulated drops land where the binomial says', () => {
  const r = mulberry32(42);
  const n = 12, N = 200000;
  const counts = Array(n + 1).fill(0);
  for (let i = 0; i < N; i++) counts[plinkoDrop(n, () => (r() < 0.5 ? 0 : 1)).bucket]++;
  binom(n).forEach((p, k) => assert.ok(Math.abs(counts[k] / N - p) < 0.004, `bucket ${k}`));
});

test('mines: cashing out after any number of safe tiles is worth exactly 99%', () => {
  for (let m = MINES_MIN; m <= MINES_MAX; m++)
    for (let k = 1; k <= TILES - m; k++) assert.ok(Math.abs(survive(k, m) * minesMult(k, m, RTP) - RTP) < 1e-9, `${m} mines, ${k} tiles`);
});

test('mines: payouts climb with every tile', () => {
  for (let m = MINES_MIN; m <= MINES_MAX; m++)
    for (let k = 2; k <= TILES - m; k++) assert.ok(minesMult(k, m, RTP) > minesMult(k - 1, m, RTP));
});

test('mines: mine placement is unbiased', () => {
  const r = mulberry32(7);
  const randInt = (n) => Math.floor(r() * n);
  const hits = Array(TILES).fill(0);
  const N = 100000;
  for (let i = 0; i < N; i++) for (const b of placeMines(3, randInt)) hits[b]++;
  hits.forEach((h, i) => assert.ok(Math.abs(h / N - 3 / TILES) < 0.006, `tile ${i}`));
  const one = placeMines(5, randInt);
  assert.equal(new Set(one).size, 5, 'no duplicate mines');
});

test('crash: chance of reaching x is 0.99 ÷ x', () => {
  const r = mulberry32(99);
  const N = 1_000_000;
  const pts = Array.from({ length: N }, () => crashPoint(r(), RTP));
  for (const x of [1.01, 1.5, 2, 5, 10, 50]) {
    const reach = pts.filter((p) => p >= x).length / N;
    assert.ok(Math.abs(reach * x - RTP) < 0.01, `target ${x}× returns ${(reach * x).toFixed(4)}`);
  }
  assert.ok(pts.every((p) => p >= 1 && p <= CRASH_CAP));
});

test('crash: the curve doubles every 8 seconds', () => {
  assert.ok(Math.abs(multAt(8000) - 2) < 1e-9);
  assert.ok(Math.abs(msFor(10) - 8000 * Math.log2(10)) < 1e-6);
  assert.equal(multAt(-5), 1);
});

// --- autoplay bookkeeping ---------------------------------------------------------------------
import { createAuto } from '../src/core/autoplay.js';

test('autoplay: runs exactly N rounds, then reports done', () => {
  const a = createAuto({ rounds: 3 });
  let done = false;
  for (let i = 0; i < 3; i++) {
    assert.ok(a.next());
    done = a.result({ profit: -100, multiplier: 0 });
  }
  assert.equal(done, true);
  assert.equal(a.next(), false);
  assert.equal(a.reason, 'done');
  assert.equal(a.played, 3);
  assert.equal(a.net, -300);
});

test('autoplay: stop conditions (loss limit, profit target, big win)', () => {
  const loss = createAuto({ rounds: Infinity, stopLoss: 250 });
  loss.next(); assert.equal(loss.result({ profit: -100 }), false);
  loss.next(); assert.equal(loss.result({ profit: -100 }), false);
  loss.next(); assert.equal(loss.result({ profit: -100 }), true);
  assert.equal(loss.reason, 'loss');

  const prof = createAuto({ stopProfit: 500 });
  prof.next(); assert.equal(prof.result({ profit: 600, multiplier: 7 }), true);
  assert.equal(prof.reason, 'profit');

  const big = createAuto({ stopWinX: 10 });
  big.next(); assert.equal(big.result({ profit: 50, multiplier: 2 }), false);
  big.next(); assert.equal(big.result({ profit: 900, multiplier: 10 }), true);
  assert.equal(big.reason, 'bigwin');
});

test('autoplay: overlapping rounds — stops dropping at the limit, finishes when the last lands', () => {
  const a = createAuto({ rounds: Infinity, stopLoss: 100 });
  a.next(); a.next(); a.next(); // three balls in the air
  assert.equal(a.result({ profit: -150 }), false, 'limit hit, but two are still falling');
  assert.equal(a.next(), false, 'no new rounds once a limit is hit');
  assert.equal(a.result({ profit: 20 }), false);
  assert.equal(a.result({ profit: 20 }), true);
  assert.equal(a.reason, 'loss');
  assert.equal(a.played, 3);
});

test('autoplay: a round that could not start is given back', () => {
  const a = createAuto({ rounds: 5 });
  a.next();
  a.abort('balance');
  assert.equal(a.left, 5);
  assert.equal(a.inflight, 0);
  assert.equal(a.finished, true);
  assert.equal(a.reason, 'balance');
});

test('autoplay: stopping by hand waits for the round in progress', () => {
  const a = createAuto({ rounds: 10 });
  a.next();
  assert.equal(a.cancel(), false, 'a round is still running');
  assert.equal(a.result({ profit: 10 }), true);
  assert.equal(a.reason, 'stopped');
});

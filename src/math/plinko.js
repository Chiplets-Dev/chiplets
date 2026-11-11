// Plinko: the ball goes left or right with even odds at every row, so the bucket it lands in
// (= number of rights) follows a binomial distribution. Multipliers grow from the middle out.

export const ROWS_MIN = 8;
export const ROWS_MAX = 16;
export const RISKS = ['low', 'medium', 'high'];

// [steepness, curve exponent] per risk level, hand-tuned for the shape of the table.
const RISK_SHAPE = { low: [1.6, 1.4], medium: [3.4, 1.7], high: [6.2, 2.0] };

export function binom(n) {
  const r = [1];
  for (let k = 1; k <= n; k++) r.push((r[k - 1] * (n - k + 1)) / k);
  const t = 2 ** n;
  return r.map((x) => x / t);
}

const roundM = (m) => (m >= 100 ? Math.round(m) : m >= 10 ? Math.round(m * 10) / 10 : Math.max(0.1, Math.round(m * 100) / 100));

const cache = new Map();

// Rounded, human-readable multipliers whose expected return lands on (just under) `rtp`.
export function plinkoTable(n, risk, rtp) {
  const key = `${n}|${risk}|${rtp}`;
  if (cache.has(key)) return cache.get(key);
  const p = binom(n);
  const [s, q] = RISK_SHAPE[risk];
  const raw = p.map((_, k) => Math.exp(s * Math.pow(Math.abs(k - n / 2) / (n / 2), q)) ** (0.6 + (0.4 * n) / 16));
  const e = raw.reduce((a, v, k) => a + v * p[k], 0);
  const m = raw.map((v) => roundM((v * rtp) / e));
  // The middle bucket(s) absorb the rounding error so the table lands on the RTP.
  const mid = n % 2 ? [Math.floor(n / 2), Math.ceil(n / 2)] : [n / 2];
  const rest = m.reduce((a, v, k) => a + (mid.includes(k) ? 0 : v * p[k]), 0);
  const pm = mid.reduce((a, k) => a + p[k], 0);
  const fix = Math.max(0.1, Math.floor(((rtp - rest) / pm) * 100) / 100);
  mid.forEach((k) => (m[k] = fix));
  const t = Object.freeze({ m: Object.freeze(m), rtp: m.reduce((a, v, k) => a + v * p[k], 0) });
  cache.set(key, t);
  return t;
}

// coin() returns 0 or 1 per row. Returns the path and the bucket.
export function plinkoDrop(n, coin) {
  const path = Array.from({ length: n }, () => coin());
  return { path, bucket: path.reduce((a, b) => a + b, 0) };
}

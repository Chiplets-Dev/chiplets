// Crash: a multiplier climbs from 1.00× until it crashes. The crash point is drawn so that
// P(crash ≥ x) = rtp / x — whatever target a player picks, the long-run return is `rtp`.

export const GROWTH = Math.log(2) / 8000; // doubles every 8 seconds
export const CRASH_CAP = 1000;

export const multAt = (ms) => Math.exp(GROWTH * Math.max(0, ms));
export const msFor = (m) => Math.log(m) / GROWTH;

// u is a uniform random number in [0, 1).
export function crashPoint(u, rtp, cap = CRASH_CAP) {
  const x = Math.floor((rtp / (1 - u)) * 100) / 100;
  return Math.min(cap, Math.max(1, x));
}

// Mines: a 5×5 grid with hidden mines. After k safe picks, the payout is rtp ÷ (chance of surviving k picks),
// so cashing out at any point is worth exactly `rtp` on average.

export const TILES = 25;
export const MINES_MIN = 1;
export const MINES_MAX = 24;

export function survive(k, mines, tiles = TILES) {
  let p = 1;
  for (let i = 0; i < k; i++) p *= (tiles - mines - i) / (tiles - i);
  return p;
}

export const minesMult = (k, mines, rtp, tiles = TILES) => (k === 0 ? 1 : rtp / survive(k, mines, tiles));

// randInt(n) → 0..n-1. Returns the mine positions.
export function placeMines(mines, randInt, tiles = TILES) {
  const idx = Array.from({ length: tiles }, (_, i) => i);
  for (let i = tiles - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, mines);
}

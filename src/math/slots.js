// Slots: 3 reels × 64 stops. Three of a kind on the middle row pays.
// Symbol weights sum to the strip length, so a symbol's chance per reel is weight / 64.

export const STOPS = 64;

export const SLOT_BASE = [
  { g: '🍒', w: 37, m: 4 },
  { g: '🍋', w: 13, m: 10 },
  { g: '🔔', w: 7, m: 33 },
  { g: '⭐', w: 4, m: 90 },
  { g: '💎', w: 2, m: 270 },
  { g: '7️⃣', w: 1, m: 1100 },
];

const hitChance = (s) => (s.w / STOPS) ** 3;

// Scales the base multipliers so the expected return is exactly `rtp`.
export function slotPays(rtp, syms = SLOT_BASE) {
  const base = syms.reduce((a, s) => a + hitChance(s) * s.m, 0);
  return syms.map((s) => (s.m * rtp) / base);
}

export function slotsRtp(pays, syms = SLOT_BASE) {
  return syms.reduce((a, s, i) => a + hitChance(s) * pays[i], 0);
}

// Fixed strip order (seeded shuffle) so the reels look the same on every visit.
export function buildStrip(syms = SLOT_BASE, seed = 7) {
  let x = seed >>> 0;
  const prng = () => (x = (x * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const strip = syms.flatMap((s, i) => Array(s.w).fill(i));
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
}

// stops = the strip index under the payline on each reel.
export function slotsResult(stops, strip, pays) {
  const symbols = stops.map((i) => strip[i]);
  const won = symbols[0] === symbols[1] && symbols[1] === symbols[2];
  return { symbols, won, mult: won ? pays[symbols[0]] : 0 };
}

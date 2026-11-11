import { STOPS, SLOT_BASE, slotPays, buildStrip, slotsResult } from '../math/slots.js';
import { payoutFor } from './common.js';

// Custom symbols only change the pictures, never the weights, so one strip serves every look.
const strip = buildStrip(SLOT_BASE);
const pays = new Map();

export function playSlots({ bet }, { randInt, rtp }) {
  if (!pays.has(rtp)) pays.set(rtp, slotPays(rtp, SLOT_BASE));
  const stops = [randInt(STOPS), randInt(STOPS), randInt(STOPS)];
  const { symbols, won, mult } = slotsResult(stops, strip, pays.get(rtp));
  return { stops, symbols, won, multiplier: mult, payout: payoutFor(bet, mult) };
}

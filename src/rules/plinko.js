import { plinkoTable, plinkoDrop, ROWS_MIN, ROWS_MAX, RISKS } from '../math/plinko.js';
import { RuleError, payoutFor } from './common.js';

export function playPlinko({ bet, rows, risk }, { rand, rtp }) {
  if (!Number.isInteger(rows) || rows < ROWS_MIN || rows > ROWS_MAX) throw new RuleError('rows', `Rows must be ${ROWS_MIN}–${ROWS_MAX}.`);
  if (!RISKS.includes(risk)) throw new RuleError('risk', 'Risk must be low, medium or high.');
  const { path, bucket } = plinkoDrop(rows, () => (rand() < 0.5 ? 0 : 1));
  const multiplier = plinkoTable(rows, risk, rtp).m[bucket];
  return { path, bucket, multiplier, payout: payoutFor(bet, multiplier) };
}

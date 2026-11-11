import { TILES, MINES_MIN, MINES_MAX, minesMult, placeMines } from '../math/mines.js';
import { RuleError, payoutFor } from './common.js';

// A round is a plain object: { bet, mines, bombs: [tile…], open: [tile…] }. The bombs never leave whoever
// holds the round (the server, for signed-in players) until it's over.

export function startMines({ bet, mines }, { randInt }) {
  if (!Number.isInteger(mines) || mines < MINES_MIN || mines > MINES_MAX) throw new RuleError('mines', `Mines must be ${MINES_MIN}–${MINES_MAX}.`);
  return { bet, mines, bombs: placeMines(mines, randInt), open: [] };
}

// What the player may see of a round in progress.
export const minesView = (round) => (round ? { bet: round.bet, mines: round.mines, open: [...round.open] } : null);

export function revealMines(round, tile, { rtp }) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILES) throw new RuleError('tile', 'No such tile.');
  if (round.open.includes(tile)) throw new RuleError('tile', 'That tile is already open.');
  if (round.bombs.includes(tile)) return { gem: false, done: true, won: false, hit: tile, multiplier: 0, payout: 0, bombs: [...round.bombs] };
  round.open.push(tile);
  const k = round.open.length;
  const multiplier = minesMult(k, round.mines, rtp);
  if (k === TILES - round.mines) return { gem: true, done: true, won: true, multiplier, payout: payoutFor(round.bet, multiplier), bombs: [...round.bombs], open: [...round.open] };
  return { gem: true, done: false, multiplier, next: minesMult(k + 1, round.mines, rtp), open: [...round.open] };
}

export function cashoutMines(round, { rtp }) {
  if (!round.open.length) throw new RuleError('empty', 'Open a tile first.');
  const multiplier = minesMult(round.open.length, round.mines, rtp);
  return { done: true, won: true, multiplier, payout: payoutFor(round.bet, multiplier), bombs: [...round.bombs], open: [...round.open] };
}

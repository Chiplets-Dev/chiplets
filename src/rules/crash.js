import { CRASH_CAP, multAt, msFor, crashPoint } from '../math/crash.js';
import { RuleError, payoutFor } from './common.js';

// A round is { bet, auto, cp, t0 } with times in ms on the holder's clock. The crash point `cp` stays with
// the holder until the round is over.

export function startCrash({ bet, auto = null }, { rand, rtp, now }) {
  if (auto !== null && auto !== undefined) {
    if (typeof auto !== 'number' || !Number.isFinite(auto) || auto < 1.01) throw new RuleError('auto', 'Auto cash-out must be 1.01× or more.');
    auto = Math.min(CRASH_CAP, Math.floor(auto * 100) / 100);
  } else auto = null;
  return { bet, auto, cp: crashPoint(rand(), rtp), t0: now };
}

// When and how the round ends if nobody cashes out by hand: at the auto target (if it's reached) or the crash.
export function crashEnd(round) {
  if (round.auto && round.auto <= round.cp) return { at: round.t0 + msFor(round.auto), won: true, multiplier: round.auto };
  return { at: round.t0 + msFor(round.cp), won: false, multiplier: 0 };
}

const result = (round, won, multiplier) => ({ done: true, won, multiplier: won ? multiplier : 0, payout: won ? payoutFor(round.bet, multiplier) : 0, cp: round.cp });

// The round's result if it has ended by `now`, else null.
export function crashSettle(round, now) {
  const end = crashEnd(round);
  return now >= end.at ? result(round, end.won, end.multiplier) : null;
}

// A cash-out at `now`. Too late means whatever already happened (auto cash-out or crash) stands.
export function cashoutCrash(round, now) {
  const over = crashSettle(round, now);
  if (over) return over;
  const m = Math.floor(multAt(now - round.t0) * 100) / 100;
  return m >= round.cp ? result(round, false, 0) : result(round, true, Math.max(1, m));
}

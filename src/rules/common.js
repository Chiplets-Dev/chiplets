// Shared by the browser (guests) and the server (signed-in players): one set of rules, tested once.
// Money is integer cents. `ctx` carries the randomness and settings: { rand, randInt, rtp, maxBet }.

export const DEFAULT_MAX_BET = 100000 * 100;

// A round that can't happen. `code` is stable (the UI turns it into words); `message` is a fallback.
export class RuleError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export function checkBet(bet, balance, maxBet = DEFAULT_MAX_BET) {
  if (!Number.isInteger(bet) || bet < 1) throw new RuleError('bet', 'Enter a bet.');
  if (bet > maxBet) throw new RuleError('bet', 'That bet is over the limit.');
  if (bet > balance) throw new RuleError('balance', 'Not enough chips.');
}

export const payoutFor = (bet, multiplier) => Math.floor(bet * multiplier);

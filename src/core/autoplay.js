// Autoplay bookkeeping, kept free of DOM so it can be tested on its own.
// Money in cents. Rounds can overlap (several plinko balls in the air), so it tracks rounds in flight
// and only reports "stopped" once the last one has landed.
export function createAuto({ rounds = Infinity, stopProfit = 0, stopLoss = 0, stopWinX = 0 } = {}) {
  let left = rounds > 0 ? rounds : Infinity;
  let inflight = 0, played = 0, net = 0, reason = null;
  const finished = () => (reason || left <= 0) && inflight === 0;

  return {
    get left() {
      return left;
    },
    get inflight() {
      return inflight;
    },
    get played() {
      return played;
    },
    get net() {
      return net;
    },
    get reason() {
      return reason || (left <= 0 ? 'done' : null);
    },
    get stopping() {
      return !!reason || left <= 0;
    },
    get finished() {
      return finished();
    },
    // May another round start? Counts it as started if so.
    next() {
      if (reason || left <= 0) return false;
      left--;
      inflight++;
      return true;
    },
    // The round that next() allowed couldn't actually start.
    abort(why) {
      left++;
      inflight--;
      reason ||= why;
    },
    // A round finished. Returns true when autoplay is completely done.
    result({ profit = 0, multiplier = 0 } = {}) {
      inflight = Math.max(0, inflight - 1);
      played++;
      net += profit;
      if (!reason) {
        if (stopWinX > 0 && multiplier >= stopWinX) reason = 'bigwin';
        else if (stopProfit > 0 && net >= stopProfit) reason = 'profit';
        else if (stopLoss > 0 && -net >= stopLoss) reason = 'loss';
      }
      return finished();
    },
    cancel(why = 'stopped') {
      reason ||= why;
      return finished();
    },
  };
}

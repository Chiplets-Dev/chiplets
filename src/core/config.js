// Site-wide settings. Read from data- attributes on the script tag, or set with Chiplets.config().
export const cfg = {
  currency: 'Chips',
  icon: '●',
  start: 1000, // starting balance, and what Refill tops back up to (whole units)
  bet: 10, // default bet
  maxBet: 100000,
  rtp: 0.99, // return to player, the same for every game
  storage: 'default', // wallet namespace, so one domain can keep separate wallets
  sound: 'on', // 'off' = start muted (visitors can still switch it on)
};

export function readScriptConfig(script) {
  if (!script) return;
  const d = script.dataset;
  if (d.currency) cfg.currency = d.currency;
  if (d.icon) cfg.icon = d.icon;
  if (+d.start > 0) cfg.start = +d.start;
  if (+d.bet > 0) cfg.bet = +d.bet;
  if (+d.maxBet > 0) cfg.maxBet = +d.maxBet;
  if (d.storage) cfg.storage = d.storage;
  if (d.sound) cfg.sound = d.sound;
}

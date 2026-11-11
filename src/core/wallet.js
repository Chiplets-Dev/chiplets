import { cfg } from './config.js';

// The guest wallet: one play-money balance per site (and storage namespace), shared by every game and tab.
// Balances are integer cents so payouts never drift from rounding. The engine module (engine.js) decides when
// a change is shown to the player, so the wallet only reports that something changed.
export const bus = new EventTarget();

const key = () => `chiplets:${cfg.storage}:wallet`;
const fresh = () => ({ c: Math.round(cfg.start * 100), played: 0, wagered: 0, returned: 0, refills: 0 });
let W = null;
let listener = null;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(key()));
    if (v && Number.isInteger(v.c) && v.c >= 0) return v;
  } catch (e) {}
  return fresh();
}

function save() {
  try {
    localStorage.setItem(key(), JSON.stringify(W));
  } catch (e) {}
  listener?.();
}

export const onWalletChange = (fn) => (listener = fn);

export const wallet = {
  get cents() {
    return (W ||= load()).c;
  },
  debit(c) {
    W ||= load();
    if (!Number.isInteger(c) || c <= 0 || c > W.c) return false;
    W.c -= c;
    W.played++;
    W.wagered += c;
    save();
    return true;
  },
  credit(c) {
    W ||= load();
    if (!Number.isInteger(c) || c <= 0) return;
    W.c += c;
    W.returned += c;
    save();
  },
  refill() {
    W ||= load();
    W.c = Math.max(W.c, Math.round(cfg.start * 100));
    W.refills++;
    save();
  },
  reset() {
    W = fresh();
    save();
  },
  stats() {
    W ||= load();
    return { ...W };
  },
  reload() {
    W = load();
    listener?.();
  },
};

// Another tab changed the balance.
window.addEventListener('storage', (e) => {
  if (e.key === key()) wallet.reload();
});

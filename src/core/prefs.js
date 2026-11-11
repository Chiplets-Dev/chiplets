import { bus } from './wallet.js';

// Per-visitor preferences (sound, turbo). Shared by every game and kept in sync across tabs.
const KEY = 'chiplets:prefs';
let P = null;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

export const prefs = {
  get(k, fallback) {
    P ||= load();
    return k in P ? P[k] : fallback;
  },
  set(k, v) {
    P ||= load();
    P[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(P));
    } catch (e) {}
    bus.dispatchEvent(new CustomEvent('prefs', { detail: { k, v } }));
  },
};

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  P = load();
  bus.dispatchEvent(new CustomEvent('prefs', { detail: {} }));
});

export const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};

// Uniform float in [0, 1) from the browser's CSPRNG.
export const rand = () => {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53;
};
export const randInt = (n) => Math.floor(rand() * n);

// Money is integer cents everywhere; this is the only place it becomes a display string.
export const fmt = (cents) => {
  const frac = Math.abs(cents) % 100 !== 0;
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
};
export const fmtX = (m) => (m >= 100 ? Math.round(m).toLocaleString() : m >= 10 ? m.toFixed(1) : m.toFixed(2)) + '×';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isImg = (s) => /^(https?:)?\/\/|^\/|\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s);
// An emoji/text symbol or an image URL, as HTML.
export const glyph = (s, cls = '') =>
  isImg(s) ? `<img class="${cls}" src="${esc(s)}" alt="">` : `<span class="${cls}">${esc(s)}</span>`;

export function makeSheet(css) {
  try {
    const s = new CSSStyleSheet();
    s.replaceSync(css);
    return s;
  } catch (e) {
    return null; // older browsers: fall back to <style> tags
  }
}

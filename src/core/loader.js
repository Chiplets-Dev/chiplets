// Loads a game's file the first time a page uses its tag, so a page with one game downloads one game.
// Plain <script> injection (not import()) so cross-origin embeds need no CORS and work under more CSPs.
export function createLoader(base, games) {
  const pending = new Map();

  function load(name) {
    const tag = `chip-${name}`;
    if (customElements.get(tag)) return Promise.resolve();
    if (!games.includes(name)) return Promise.reject(new Error(`Chiplets: unknown game "${name}"`));
    if (pending.has(name)) return pending.get(name);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL(`games/${name}.js`, base).href;
      s.async = true;
      s.onload = () => customElements.whenDefined(tag).then(resolve);
      s.onerror = () => {
        pending.delete(name);
        reject(new Error(`Chiplets: couldn't load ${s.src}`));
      };
      (document.head || document.documentElement).append(s);
    });
    pending.set(name, p);
    return p;
  }

  const waiting = () => games.filter((g) => !customElements.get(`chip-${g}`) && !pending.has(g));

  function scan(node) {
    const left = waiting();
    if (!left.length) return;
    const found = new Set();
    if (node.localName?.startsWith('chip-')) found.add(node.localName.slice(5));
    if (node.firstElementChild || node === document) {
      for (const el of node.querySelectorAll(left.map((g) => `chip-${g}`).join(','))) found.add(el.localName.slice(5));
    }
    for (const g of found) if (left.includes(g)) load(g).catch((e) => console.warn(e.message));
  }

  function start() {
    scan(document);
    if (!waiting().length) return;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
      if (!waiting().length) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  return { load, scan, start };
}

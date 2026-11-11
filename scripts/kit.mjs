// Bundles the kit: the core script, one file per game, and everything in one file. Shared by this repository's
// build and by the public repository's (scripts/export-public.mjs copies this file there), so both produce the
// same bytes from the same source.
import { build } from 'esbuild';

export const GAMES = ['slots', 'plinko', 'mines', 'crash'];
export const banner = (version) => `/*! Chiplets v${version} · play-money casino games for any website · https://chiplets.dev · MIT */`;

const options = (version) => ({
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'chrome100', 'firefox100', 'safari16'],
  legalComments: 'none',
  write: false,
  define: { __VERSION__: JSON.stringify(version), __GAMES__: JSON.stringify(GAMES) },
});

export const bundle = async (entry, version) => (await build({ ...options(version), entryPoints: [entry] })).outputFiles[0].text.trim();

// { 'chiplets.js': code, 'games/slots.js': code, …, 'chiplets.all.js': code }
export async function buildKit(version) {
  const BANNER = banner(version);
  const files = { 'chiplets.js': `${BANNER}\n${await bundle('src/core/index.js', version)}\n` };
  for (const g of GAMES) files[`games/${g}.js`] = `${BANNER}\n${await bundle(`src/games/${g}.js`, version)}\n`;
  files['chiplets.all.js'] = [BANNER, files['chiplets.js'].replace(BANNER, '').trim(), ...GAMES.map((g) => files[`games/${g}.js`].replace(BANNER, '').trim())].join('\n') + '\n';
  return files;
}

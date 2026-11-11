// Builds dist/: chiplets.js (the core), games/<name>.js (one per game, loaded on demand) and chiplets.all.js
// (everything in one file). These are the files chiplets.dev serves.
//
//   node scripts/build.mjs            build, and print each file's size and integrity hash
//   node scripts/build.mjs --verify   also check every hash against integrity.json: the build must reproduce
//                                     the released files of this version byte for byte
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { buildKit } from './kit.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const files = await buildKit(version);
const sri = (code) => `sha384-${createHash('sha384').update(code).digest('base64')}`;

await rm('dist', { recursive: true, force: true });
for (const [name, code] of Object.entries(files)) {
  const out = path.join('dist', name);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, code);
}

console.log(`Chiplets v${version} → dist/`);
for (const [name, code] of Object.entries(files)) {
  const kb = (n) => `${(n / 1024).toFixed(1).padStart(5)} KB`;
  console.log(`  ${name.padEnd(16)} ${kb(Buffer.byteLength(code))}  ${kb(gzipSync(code).length)} gz  ${sri(code)}`);
}

if (process.argv.includes('--verify')) {
  const released = JSON.parse(await readFile('integrity.json', 'utf8'))[version];
  if (!released) {
    console.error(`✖ integrity.json has no entry for v${version} (not released yet?)`);
    process.exit(1);
  }
  const wrong = Object.keys(released).filter((name) => !files[name] || sri(files[name]) !== released[name]);
  if (wrong.length) {
    console.error(`✖ v${version}: this build differs from the released files: ${wrong.join(', ')}`);
    process.exit(1);
  }
  console.log(`✔ v${version}: all ${Object.keys(released).length} files match integrity.json`);
}

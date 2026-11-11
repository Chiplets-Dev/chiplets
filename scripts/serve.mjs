// A tiny static server for the demo page: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
const root = process.cwd();
const port = Number(process.argv[2]) || 8080;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') return res.writeHead(302, { location: '/demo/' }).end();
  const wanted = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const file = path.join(root, path.normalize(decodeURIComponent(wanted)));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch (e) {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Chiplets demo → http://localhost:${port}/`));

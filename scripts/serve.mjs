/**
 * Tiny static server for dist/ (no dependencies). Mirrors GitHub Pages closely
 * enough for local testing, including serving 404.html for unknown paths.
 *
 *   npm run serve                                        # http://localhost:4173/
 *   BASE_PATH=/premier-werkz-coming-soon/ npm run serve  # emulate the Pages project path
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE }).end();
    return;
  }
  if (pathname.startsWith(BASE)) {
    let file = normalize(join(DIST, pathname.slice(BASE.length)));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return send(res, 200, file);
  }
  send(res, 404, join(DIST, '404.html'));
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}${BASE}`));

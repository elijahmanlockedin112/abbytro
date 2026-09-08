// Tiny zero-dependency static server so ES modules work (file:// blocks them).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8137);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + url); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

// If the port is taken (usually an older copy of this server still running),
// walk up to the next free one rather than dying with a stack trace.
function listen(p, attemptsLeft) {
  const onError = err => {
    server.removeListener('listening', onListening);
    if (err.code !== 'EADDRINUSE') throw err;
    if (attemptsLeft <= 0) {
      console.error(`Ports ${port}-${p} are all in use. Free one, or set PORT=1234.`);
      process.exit(1);
    }
    console.log(`Port ${p} is in use, trying ${p + 1}...`);
    listen(p + 1, attemptsLeft - 1);
  };
  const onListening = () => {
    server.removeListener('error', onError);
    console.log(`Abbytro: http://localhost:${p}`);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(p);
}

listen(port, 10);

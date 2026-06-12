import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  const file = path.join(root, url === '/' ? 'index.html' : url.replace(/^\//, ''));
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'text/plain' });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`Vibe site: http://localhost:${port}`);
  console.log(`Serving ${root}`);
});

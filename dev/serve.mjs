// Serves the repository on http://127.0.0.1:4173 so dev/preview.html can load dist/hubb-ha-ui.js.
// Local only, no dependencies. `npm run preview` builds first, then starts this.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const port = Number(process.env.PORT ?? 4173);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // The preview rewrites its address to /hubb-casa/...; anything there is the preview page itself.
  const wanted = url.pathname.startsWith('/hubb-casa/') ? '/dev/preview.html' : url.pathname === '/' ? '/dev/preview.html' : url.pathname;
  const path = normalize(join(root, decodeURIComponent(wanted)));
  if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/dev/preview.html`));

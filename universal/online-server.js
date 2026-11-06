const http = require('http');
const fs = require('fs');
const path = require('path');

const ONLINE_PORT = process.env.ONLINE_PORT || 4000;
const BACKEND_PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const onlineDir = path.join(rootDir, 'online');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function serveOnlineVoter(res) {
  return serveFile(res, path.join(onlineDir, 'index.html'));
}

function serveMobilePublic(res, fileName) {
  const html = fs.readFileSync(path.join(publicDir, fileName), 'utf8')
    .replace('</head>', '<link rel="stylesheet" href="/online/mobile.css"></head>');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function proxyApi(req, res) {
  const proxy = http.request({ hostname: '127.0.0.1', port: BACKEND_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` } }, backendRes => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, message: 'Backend port 3000 belum berjalan.' })); });
  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return proxyApi(req, res);
  if (req.url === '/' || req.url === '/index.html') return serveOnlineVoter(res);
  if (req.url === '/admin.html') return serveMobilePublic(res, 'admin.html');
  if (req.url === '/statistik.html') return serveMobilePublic(res, 'statistik.html');
  if (req.url === '/online/mobile.css') return serveFile(res, path.join(onlineDir, 'mobile.css'));
  if (req.url === '/online/online.js') return serveFile(res, path.join(onlineDir, 'online.js'));
  if (req.url.startsWith('/tutorial/')) return serveFile(res, path.join(rootDir, req.url));
  if (req.url.startsWith('/css/') || req.url.startsWith('/js/') || req.url.startsWith('/images/')) return serveFile(res, path.join(publicDir, req.url));
  res.writeHead(404); res.end('Not found');
});

server.listen(ONLINE_PORT, '0.0.0.0', () => {
  console.log(`[ONLINE] Frontend online: http://localhost:${ONLINE_PORT}`);
  console.log(`[ONLINE] Backend bersama: http://localhost:${BACKEND_PORT}`);
  console.log(`[ONLINE] Admin: http://localhost:${ONLINE_PORT}/admin.html`);
  console.log(`[ONLINE] Statistik: http://localhost:${ONLINE_PORT}/statistik.html`);
});

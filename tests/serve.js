// Simple static file server for AcimCaisse e2e tests.
// Serves on http://localhost:8765 from the repo root.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { html: 'text/html', js: 'text/javascript', json: 'application/json', css: 'text/css', png: 'image/png', svg: 'image/svg+xml', woff: 'font/woff', ico: 'image/x-icon' };
http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/pos.html';
  let filePath = path.join(root, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('NF'); return; }
    let ext = path.extname(filePath).slice(1).toLowerCase();
    res.setHeader('Content-Type', types[ext] || 'text/plain');
    res.end(data);
  });
}).listen(8765, () => console.log('http://localhost:8765/'));

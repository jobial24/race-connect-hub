// Servidor de producción: sirve la app compilada (dist/) + la API, sin Vite.
//   npm run build && npm start        → http://localhost:3000
// Se puede publicar tal cual en Render, Railway, Fly.io o un VPS para que la app
// móvil (Capacitor/PWA) tenga backend: en la app, VITE_API_BASE=https://tu-servidor
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createMiddleware } from './vitePlugin.js';
import { SUPABASE_DEFAULTS } from '../supabase/config.js';

const ROOT = process.cwd();
// .env mínimo sin dependencias
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

process.env.SUPABASE_URL ||= SUPABASE_DEFAULTS.url;
process.env.SUPABASE_PUBLISHABLE_KEY ||= SUPABASE_DEFAULTS.publishableKey;

const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const api = createMiddleware(process.env);

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const base of [DIST, PUBLIC]) {
    const file = path.join(base, urlPath);
    if (file.startsWith(base) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
      if (urlPath.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(file).pipe(res);
    }
  }
  // SPA: cualquier otra ruta devuelve index.html
  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) {
    res.statusCode = 500;
    return res.end('Falta dist/. Ejecuta primero: npm run build');
  }
  res.setHeader('Content-Type', TYPES['.html']);
  fs.createReadStream(index).pipe(res);
}

const port = Number(process.env.PORT || 3000);
http
  .createServer((req, res) => api(req, res, () => serveStatic(req, res)))
  .listen(port, () => console.log(`Race Connect Hub en http://localhost:${port}`));

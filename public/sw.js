// Service worker mínimo: la app abre sin conexión con lo último que vio.
// - Navegación y estáticos: primero caché, se actualiza en segundo plano.
// - /api y /races.json: siempre red (datos frescos); si no hay red, lo cacheado.
const CACHE = 'rch-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/') || url.pathname === '/races.json') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (url.pathname === '/races.json' || url.pathname === '/api/races/sync') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname))
    );
    return;
  }

  const key = req.mode === 'navigate' ? '/' : req;
  e.respondWith(
    caches.match(key).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

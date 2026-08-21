const CACHE_NAME = 'chemlist-v2';
const urlsToCache = ['./', './index.html', './app.js', './logo.png', './manifest.json'];

self.addEventListener('install', (e) => {
  // Obliga a la aplicación a instalarse de inmediato
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', (e) => {
  // Destruye cualquier versión anterior del caché y asume el control
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Intenta descargar de internet primero (siempre actualizado)
  // Si no hay red, recurre al caché
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

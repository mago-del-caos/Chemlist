self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('chemlist-cache').then((cache) => cache.addAll(['./', './index.html', './app.js', './logo.png', './manifest.json'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});

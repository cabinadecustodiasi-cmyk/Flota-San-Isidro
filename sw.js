const CACHE_NAME = 'flota-si-v1';
const assets = [
  './',
  './index.html',
  './app.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Instalar Service Worker y guardar en caché la estructura básica
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Activar e interceptar peticiones
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      return cachedResponse || fetch(e.request);
    })
  );
});
const CACHE_NAME = 'coordenadas-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/apps-script-cors.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
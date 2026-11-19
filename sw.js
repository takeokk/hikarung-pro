const CACHE_NAME = 'hikarung-pro-v2.4.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './samples/%E6%87%B8%E5%91%BD%E3%81%AB%E3%81%B5%E3%82%93%E3%81%B0%E3%82%8A%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%97%E3%82%92%E3%81%99%E3%82%8B%E3%82%82%E8%B6%B3%E5%A0%B4%E3%81%AB%E5%B1%8A%E3%81%8B%E3%81%AA%E3%81%8B%E3%81%A3%E3%81%9F%E3%83%A8%E3%83%83%E3%82%B7%E3%83%BC%E3%81%AE%E3%83%A2%E3%83%8E%E3%83%9E%E3%83%8D.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { });
        return cachedResponse;
      }
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});

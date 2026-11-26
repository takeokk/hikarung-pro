const CACHE_NAME = 'hikarung-pro-v4.0.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/constants.js',
  './js/db.js',
  './js/media-library.js',
  './js/app.js',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  encodeURI('./samples/01_タイトル決定音_ジャン.wav'),
  encodeURI('./samples/02_クイズ正解_ピンポン.wav'),
  encodeURI('./samples/03_クイズ不正解_ブッブー.wav'),
  encodeURI('./samples/07_トークBGM_ChillLoop.wav'),
  encodeURI('./samples/08_オープニングBGM_Upbeat.wav'),
  encodeURI('./samples/懸命にふんばりジャンプをするも足場に届かなかったヨッシーのモノマネ.mp3')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never cache-intercept no-store connectivity checks (e.g. updateAppCache probe)
  if (event.request.cache === 'no-store') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const networkUpdate = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            return caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
              .then(() => networkResponse);
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkUpdate);
        return cachedResponse;
      }

      return networkUpdate.then((res) => {
        if (res) return res;
        // Only fall back to index.html for page navigations, never for audio/asset fetches
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

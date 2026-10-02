// MyCinema Production Service Worker v5 (Resilient Network-First App Shell & TMDB Image Cache)
const CACHE_NAME = 'mycinema-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== 'tmdb-images-cache') {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Never intercept API calls (always allow direct network)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('themoviedb.org')) {
    return;
  }

  // 2. Handle TMDB image caching (posters and backdrops)
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      caches.open('tmdb-images-cache').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse || Response.error());
        });
      })
    );
    return;
  }

  // 3. Navigation requests (HTML pages): NETWORK FIRST, falling back to cache if offline
  // This guarantees users always get the latest bundle and never get trapped in stale HTML.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, fonts, icons): Cache first, fallback to network
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});

// MyCinema Production Service Worker v7 (New Brand Identity & Resilient App Shell)
const CACHE_NAME = 'mycinema-v8';
// v2: older versions stored opaque responses, which Chrome pads to ~7 MB each.
const IMAGE_CACHE_NAME = 'tmdb-images-v2';
const IMAGE_CACHE_MAX_ENTRIES = 400;

// Keep the poster cache bounded so it never exhausts the origin's storage quota.
const trimImageCache = async (cache) => {
  const keys = await cache.keys();
  const excess = keys.length - IMAGE_CACHE_MAX_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
};
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/icon.svg',
  '/branding/mycinema-inside-logo.png',
  '/branding/mycinema-inside-logo@2x.png',
  '/branding/mycinema-inside-symbol.png',
  '/branding/mycinema-inside-symbol@2x.png',
  '/branding/mycinema-outside-icon.png',
  '/branding/mycinema-wordmark.png',
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
          if (key !== CACHE_NAME && key !== IMAGE_CACHE_NAME) {
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
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Request in CORS mode so the cached entry has its real size (opaque
          // responses are quota-padded and would crowd out IndexedDB data).
          return fetch(event.request.url, { mode: 'cors', credentials: 'omit' })
            .catch(() => fetch(event.request))
            .then((networkResponse) => {
              if (networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(event.request, networkResponse.clone()).then(() => trimImageCache(cache)).catch(() => {});
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

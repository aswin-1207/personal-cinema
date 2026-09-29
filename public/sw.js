// Personal Cinema Service Worker v3 (Offline-First App Shell & TMDB Image Cache)
const CACHE_NAME = 'personal-cinema-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
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

  // 1. Never intercept API calls (allow direct network with proper headers)
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

  // 3. App Shell & Static assets
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

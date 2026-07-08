/**
 * Service worker for Evie's Reading Realms (GitHub Pages, /readyreaders/).
 *
 * Strategy:
 *  - navigations: network-first, falling back to the cached app shell ('./')
 *  - everything else same-origin (hashed js, fonts, audio, icons):
 *    cache-first with network fill
 *
 * Bump CACHE_VERSION to invalidate all previously cached assets.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `reading-realms-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['./']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so updates land, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache full, same-origin, OK responses (never opaque/errors).
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./', copy));
          }
          return response;
        })
        .catch(() =>
          caches.match('./').then((cached) => cached ?? Response.error()),
        ),
    );
    return;
  }

  // Static assets: cache-first with network fill.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

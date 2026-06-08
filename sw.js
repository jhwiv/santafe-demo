/*
 * Santa Fe · June 2026 — Service Worker
 *
 * Strategy: app-shell precache + stale-while-revalidate.
 *
 * Why this matters: travelers will be at Bandelier, the balloon launch site, and
 * potentially driving between Santa Fe and pueblos with no signal. Without
 * a service worker, tapping the home-screen icon in a dead zone shows a
 * blank page. With this, the last cached shell renders instantly and any
 * cached responses surface for assets the visitor has already loaded.
 *
 * Cache name is versioned by the cache-bust hash baked into index.html so
 * a redeploy automatically invalidates the old cache.
 */

// CACHE_VERSION rotates whenever this file ships — the auto-cache-bust
// pipeline updates the date+hash so old caches get cleaned up on activate.
// IMPORTANT: bump this on every deploy. The auto-cache-bust workflow also
// rewrites the date+hash below so SW reinstalls + repopulates the cache.
const CACHE_VERSION = 'santafe-shell-20260608-e5b1510';

// Precache the bare asset paths (no ?v= querystring). The fetch handler
// matches with `ignoreSearch: true` so any cache-busted querystring still
// resolves to the cached entry. This decouples SW cache lifetime from
// the page's cache-bust hash — ship a new hash, the SW still serves
// the same files until you bump CACHE_VERSION on a real content change.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/assets/restaurants/restaurants.css',
  '/assets/restaurants/restaurants.js',
  '/manifest.webmanifest',
  '/img/hero.jpg',
  '/img/apple-touch-icon.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/brand-wordmark.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll is atomic — if any single asset fails, install fails and the
      // old SW stays. Use individual adds so a single 404 doesn't kill it.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache skip', url, err.message);
          })
        )
      )
    )
  );
  // Take control on first install so the page is immediately offline-ready
  // after the user's first online visit.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('santafe-shell-') && k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GETs. Skip cross-origin (Viator, OpenTable, etc.)
  // so they always go to the network; we don't want to cache or proxy those.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations so the visitor always gets latest content
  // when online, but falls back to cached shell when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Cache the latest navigation for offline use.
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match('/index.html') || caches.match('/'))
        )
    );
    return;
  }

  // For versioned assets (anything carrying a ?v= cache-bust querystring),
  // use NETWORK-FIRST with cache fallback. Each version is a distinct URL
  // so the cache is keyed precisely — no stale-JS-served-to-fresh-HTML bug.
  // For unversioned assets (images, manifest, icons), use stale-while-
  // revalidate via ignoreSearch since they rarely change.
  const hasVersion = url.searchParams.has('v');

  if (hasVersion) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // Cache-first with background refresh for unversioned assets (icons, manifest, hero image).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Allow the page to ask SW to update / clear / version-check.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION') {
    event.ports[0]?.postMessage(CACHE_VERSION);
  }
});

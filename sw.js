/* ============================================================================
   Service worker — makes the app installable and work with no connection.

   Worth having beyond the install badge: this gets shared on WhatsApp and opened
   on patchy mobile data, and the whole thing is 90KB of static files. Once it has
   been opened one time it should never fail to open again.

   Two strategies, split by what staleness costs:

     code and markup   network-first, with a short timeout. This is a one-day
                       event, and cache-first would show a visitor the version
                       they loaded last time — so a fix pushed on the 14th would
                       not reach anyone who had already opened the page. The
                       timeout means a bad network still falls back to cache
                       fast rather than hanging on a dead request.
     art and fonts     stale-while-revalidate. These are large, they rarely
                       change, and a frame of yesterday's flag costs nothing.

   Bump VERSION on deploy; activate then drops every older cache outright.
   ========================================================================== */

const VERSION = 'tiranga-v7';
const NETWORK_TIMEOUT = 1800;

/* Relative so this works both at a domain root and under a GitHub Pages
   subpath, where the worker's scope is a folder rather than '/'. */
const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'config.js',
  'ticker.js',
  'cloth.js',
  'celebrate.js',
  'store.js',
  'certificate.js',
  'coach.js',
  'app.js',
  'manifest.webmanifest',
  'favicon.svg',
  'flags/tiranga.svg',
  'flags/union-jack.svg',
  'fort-wall.svg',
  'fort-gate.svg',
  'og.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    /* Individually, not addAll: one 404 in the list would otherwise reject the
       whole install and leave the app with no worker at all. */
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Any cached copy of the app shell still gives a visitor the whole ceremony. */
async function shell(cache) {
  return (await cache.match('index.html')) || (await cache.match('./'));
}

/** Serve from cache at once, then refresh the entry in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);

  const fresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (hit) return hit;
  return (await fresh) || Response.error();
}

/** Prefer the network, but never wait longer than NETWORK_TIMEOUT for it. */
async function networkFirst(request) {
  const cache = await caches.open(VERSION);

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NETWORK_TIMEOUT)),
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    /* Offline, or the network is taking too long to be worth waiting for. */
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const fallback = await shell(cache);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

const CODE = /\.(?:js|css|webmanifest)$/;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);

  /* Everything else — Firestore reads and writes above all — is left alone.
     Caching a hoist count would serve a stale number, and caching a write would
     be actively wrong. */
  if (!sameOrigin && !isFont) return;

  const fresh = request.mode === 'navigate' || (sameOrigin && CODE.test(url.pathname));
  event.respondWith(fresh ? networkFirst(request) : staleWhileRevalidate(request));
});

'use strict';

// docdoc service worker.
//
// Its job is narrow on purpose: keep the public static shell available so that
// a slow or interrupted network does not strip the interface, and answer a
// failed navigation with a page that explains the offline state. It never
// stores a document: every page carries one account's domains, themes and
// outline, and a shared device must not be able to read another account's data
// from Cache Storage.
//
// CACHE_VERSION must be incremented whenever a precached file (style.css,
// pwa.js, app.js, htmx.min.js, an icon, the manifest, offline.html) changes:
// the cache name is what makes a deployment's new assets visible. See
// `Readme.md`, section « Installer docdoc ».

const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'docdoc-static-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const OFFLINE_URL = '/offline.html';

// Public, identical for every account. Anything not listed here is left to the
// browser: that is what keeps /auth/*, /api/*, /domaine/* and every POST out of
// the cache.
const PRECACHE_URLS = [
  '/style.css',
  '/pwa.js',
  '/app.js',
  '/auth.js',
  '/simplewebauthn.js',
  '/htmx.min.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon-180.png',
  '/icons/favicon-32.png',
];

const STATIC_PATHS = new Set([
  '/style.css',
  '/pwa.js',
  '/app.js',
  '/auth.js',
  '/simplewebauthn.js',
  '/htmx.min.js',
  '/manifest.webmanifest',
  OFFLINE_URL,
]);

function isStaticPath(pathname) {
  return STATIC_PATHS.has(pathname) || pathname.startsWith('/icons/');
}

/* ------------------------------------------------------------------ */
/* Install: cache the offline page, then the static shell.             */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // The offline page is the one entry that must exist: without it a failed
      // navigation falls back to the browser's own error page.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));

      // A missing optional asset must not abort the installation: a stale or
      // incomplete deployment still gets the offline fallback and the update
      // flow.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[docdoc sw] actif non mis en cache :', url, err.message);
          })
        )
      );

      await self.skipWaiting();
    })()
  );
});

/* ------------------------------------------------------------------ */
/* Activate: drop the previous version, claim the open pages.          */
/* ------------------------------------------------------------------ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* ------------------------------------------------------------------ */
/* Fetch: navigations network-only, public assets stale-while-         */
/* revalidate, everything else untouched.                              */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Non-GET requests (forms, htmx mutations) and cross-origin requests keep the
  // browser's normal behaviour: no respondWith, no cache, no interception.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticPath(url.pathname)) {
    event.respondWith(handleStaticAsset(event, request));
  }
});

async function handleNavigation(request) {
  try {
    // Always ask the server: an HTML document is personal and must reflect the
    // current session, never a cached earlier one.
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Hors ligne — docdoc</title>' +
        '<p>docdoc est indisponible hors ligne. Vérifiez votre connexion puis réessayez.</p></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function handleStaticAsset(event, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {
          // A failed write only costs one cache refresh; never fail the request.
        });
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Serve immediately, refresh in the background for the next visit.
    event.waitUntil(network);
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;

  // The asset is neither cached nor reachable: let the page see a plain
  // failure rather than a fabricated resource.
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

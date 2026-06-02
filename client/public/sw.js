// Travel Buddy service worker.
// Two cache strategies:
//   - App shell (HTML/JS/CSS/icons): network-first, fall back to cache. Keeps
//     the app loadable when offline.
//   - Map tiles (CARTO basemaps, OSM): cache-first with size cap. Tiles are
//     immutable per (z,x,y), so caching forever is safe up to a quota.
//
// We do NOT cache /api/* — that always hits the network. Offline writes are
// handled by an IndexedDB queue in the page (see lib/offlineQueue.js).

const SW_VERSION = "tb-1";
const APP_CACHE = `tb-app-${SW_VERSION}`;
const TILE_CACHE = `tb-tiles-${SW_VERSION}`;
const TILE_CACHE_LIMIT = 800;

self.addEventListener("install", (event) => {
  // Take control on next page load without forcing reload.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isTileRequest(url) {
  return (
    /(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname) ||
    /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)
  );
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // Drop the oldest entries (cache.keys() returns insertion order).
  const drop = keys.length - max;
  for (let i = 0; i < drop; i++) {
    await cache.delete(keys[i]);
  }
}

async function tileFetch(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      cache.put(request, fresh.clone()).then(() => trimCache(TILE_CACHE, TILE_CACHE_LIMIT));
    }
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function appFetch(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(APP_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: serve cached index.html for SPA routes.
    if (request.mode === "navigate") {
      const fallback = await caches.match("/");
      if (fallback) return fallback;
    }
    throw new Error("offline_no_cache");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept API calls — they're handled (and queued) by the page.
  if (url.pathname.startsWith("/api/")) return;

  if (isTileRequest(url)) {
    event.respondWith(tileFetch(req));
    return;
  }

  // Same-origin app shell.
  if (url.origin === self.location.origin) {
    event.respondWith(appFetch(req));
  }
});

// The page can ping the SW to estimate cached tile coverage.
self.addEventListener("message", async (event) => {
  if (event.data?.type === "tile-stats") {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    event.source?.postMessage({ type: "tile-stats", count: keys.length });
  }
});

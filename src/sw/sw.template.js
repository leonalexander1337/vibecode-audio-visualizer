// Service worker template — vite.config.ts fills in the placeholders at build time.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `vibecode-visualizer-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(req.mode === 'navigate' ? networkFirst(req) : cacheFirst(req));
});

// Pages: try the network (new deploys), fall back to the cache when offline or slow.
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req), 3000);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) ?? (await cache.match('./')) ?? Response.error();
  }
}

// Assets have content hashes in their names, so a cached copy is always right.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

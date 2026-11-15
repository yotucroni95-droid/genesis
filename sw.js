// Gênesis service worker: lets the game open with weak or no internet and
// makes sure players always get the newest version when they are online.
//   * code and content (HTML, JS, CSS, JSON): network first, cache as backup
//   * images and fonts: cache first, refreshed in the background

const CACHE = 'genesis-v8';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './css/style.css', './src/main.js', './assets/manifest.json'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isMedia(url) {
  return /\.(png|jpe?g|webp|gif|svg|woff2?|ttf|mp3|m4a)$/i.test(url.pathname) || url.hostname.includes('fonts.g');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // navigation requests cannot be re-created with options, so use the URL
    const fresh = request.mode === 'navigate' ? await fetch(request.url, { cache: 'no-cache' }) : await fetch(request, { cache: 'no-cache' });
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()); return res; }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !url.hostname.includes('fonts.g')) return;
  event.respondWith(isMedia(url) ? cacheFirst(request) : networkFirst(request));
});

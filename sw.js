// Gênesis service worker: the game works 100% offline after the first visit
// and players still get the newest version whenever they are online.
//   * code and content (HTML, JS, CSS, JSON): network first, cache as backup
//   * images, sounds and voices: cache first (kept between versions)
//   * on the first visit every file listed in precache.json is downloaded
//   * iPhones ask for audio in pieces (Range): answered from the cache

const VERSION = 22;
const CODE = `genesis-code-v${VERSION}`;
const MEDIA = 'genesis-media'; // big files: not deleted when the code changes

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CODE).then((c) => c.addAll(['./', './index.html', './css/style.css', './src/main.js', './assets/manifest.json'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CODE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isMedia = (url) => /\.(png|jpe?g|webp|gif|svg|woff2?|ttf|mp3|m4a)$/i.test(url.pathname) || url.hostname.includes('fonts.g');
const isAudio = (url) => /\.(mp3|m4a)$/i.test(url.pathname);

/** Downloads everything the game needs, a few files at a time. */
let precaching = null;
function precacheAll() {
  if (precaching) return precaching;
  precaching = (async () => {
    const list = await fetch('precache.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => null);
    if (!list) return;
    const code = await caches.open(CODE);
    const media = await caches.open(MEDIA);
    const base = new URL('./', self.registration.scope);
    const queue = list.files.slice();
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const path = queue.shift();
        const url = new URL(path, base);
        const cache = isMedia(url) ? media : code;
        try {
          if (!(await cache.match(url.href))) {
            const res = await fetch(url.href, { cache: 'no-cache' });
            if (res.status === 200) await cache.put(url.href, res);
          }
        } catch { /* offline right now: try again next time */ }
        done += 1;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    const clients = await self.clients.matchAll();
    for (const c of clients) c.postMessage({ type: 'offline-ready', files: done });
  })().finally(() => { precaching = null; });
  return precaching;
}

self.addEventListener('message', (event) => {
  if (event.data === 'precache') event.waitUntil(precacheAll());
});

async function networkFirst(request) {
  const cache = await caches.open(CODE);
  try {
    // navigation requests cannot be re-created with options, so use the URL
    const fresh = request.mode === 'navigate' ? await fetch(request.url, { cache: 'no-cache' }) : await fetch(request, { cache: 'no-cache' });
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (request.mode === 'navigate' && (await cache.match('./')));
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request);
  // refresh in the background, so new art replaces the old next time
  const refresh = fetch(request).then((res) => { if (res && res.status === 200) cache.put(request, res.clone()).catch(() => {}); return res; }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

/** Audio from the cache, cut to the piece (Range) the phone asked for. */
async function audio(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request.url);
  if (!cached) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return cached;
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !url.hostname.includes('fonts.g')) return;
  if (isAudio(url)) { event.respondWith(audio(request)); return; }
  event.respondWith(isMedia(url) ? cacheFirst(request) : networkFirst(request));
});

/* Physics Project – B — offline-first service worker
 * Bump VERSION whenever you ship changes so clients pick up a fresh cache.
 */
const VERSION = 'v2';
const PRECACHE = 'ppb-precache-' + VERSION;
const RUNTIME = 'ppb-runtime-' + VERSION;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/test.html',
  '/ThankYou.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);

    // Extra files you want kept on the device can be listed in
    // /offline-files.json — they are pulled in on every install,
    // so future files are cached without anyone visiting them.
    let extra = [];
    try {
      const res = await fetch('/offline-files.json', { cache: 'no-store' });
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) extra = data.files;
      }
    } catch (err) { /* no manifest, carry on */ }

    const targets = PRECACHE_URLS.concat(extra);
    await Promise.all(targets.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (err) { /* skip a failure, keep the rest */ }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // Range requests (audio/video seeking) are served from the cached full body.
  if (req.headers.has('range')) {
    event.respondWith(serveRange(req, url));
    return;
  }

  event.respondWith(serve(req, url));
});

const isHTML = (req) =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').indexOf('text/html') !== -1;

async function serve(req, url) {
  const html = isHTML(req);
  const key = html ? '/index.html' : url.pathname;

  // 1. cache-first: instant paint / instant file, even fully offline
  const hit =
    (await caches.match(req, { ignoreSearch: true })) ||
    (await caches.match(key));
  if (hit) {
    revalidate(req, key); // refresh quietly in the background
    return hit;
  }

  // 2. not cached yet (a future file) — fetch once, then it lives on the device
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(RUNTIME);
      await cache.put(key, res.clone());
    }
    return res;
  } catch (err) {
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

function revalidate(req, key) {
  fetch(new Request(req.url, { cache: 'no-cache' }))
    .then(async (res) => {
      if (!res || !res.ok || res.type !== 'basic') return;
      const cache = await caches.open(RUNTIME);
      await cache.put(key, res.clone());
    })
    .catch(() => {});
}

async function serveRange(req, url) {
  const cached = await caches.match(url.pathname);
  if (!cached) return fetch(req);

  const buffer = await cached.clone().arrayBuffer();
  const size = buffer.byteLength;
  const header = req.headers.get('range') || '';
  const match = /bytes=(\d*)-(\d*)/.exec(header);

  let start = 0;
  let end = size - 1;
  if (match) {
    if (match[1]) start = parseInt(match[1], 10);
    if (match[2]) end = Math.min(parseInt(match[2], 10), end);
    if (!match[1] && match[2]) {
      start = Math.max(0, size - parseInt(match[2], 10));
      end = size - 1;
    }
  }
  if (start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': 'bytes */' + size }
    });
  }

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}

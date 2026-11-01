// Service worker: keeps the installed app working offline. Installing caches the page and every
// recording, so the app works offline from the first launch. The page itself comes from the network
// first, so every launch shows the latest deploy; the cached copy is used offline or when the
// network takes longer than NETWORK_TIMEOUT_MS. Its small files are answered from the cache straight
// away and refreshed in the background. The recordings (about 12 MB) are only taken from the cache,
// never fetched again: bump CACHE to drop everything cached by an older version, and always when a
// recording changes.
const CACHE = 'polka-v4';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
// Every file band-engine.ts loads
const SOUNDS = [
  './sounds/bd.mp3',
  './sounds/china.wav',
  './sounds/voice.wav',
  './sounds/recorder.wav',
  './sounds/guitar.wav',
  './sounds/choir.wav',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // The shell skips the HTTP cache (reload), where GitHub Pages keeps the previous deploy for 10
      // minutes; the recordings come from it, as the page has just downloaded them
      .then((cache) => cache.addAll([...SHELL.map((url) => new Request(url, { cache: 'reload' })), ...SOUNDS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Only this app's old caches: the FS apps share one origin, so its other apps' caches are here too
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('polka-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      // A link to a shared take (?take=…) is the same page, so it is cached once, without the query
      const key = url.search ? url.origin + url.pathname : request;
      const store = (response) => {
        if (response.ok) cache.put(key, response.clone());
        return response;
      };
      if (url.pathname.includes('/sounds/')) return cached ?? fetch(request).then(store);
      // no-cache: ask the server (a cheap 304 when unchanged) instead of taking the HTTP cache's copy
      const fresh = fetch(request.url, { cache: 'no-cache' }).then(store);
      if (!cached) return fresh;
      event.waitUntil(fresh.catch(() => {}));
      if (request.mode !== 'navigate') return cached;
      const network = fresh.then((response) => (response.ok ? response : cached), () => cached);
      const slow = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
      return Promise.race([network, slow]);
    })
  );
});

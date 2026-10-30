// Service worker: keeps the installed app working offline. Installing caches the page and every
// recording, so the app works offline from the first launch. The page and its small files are
// answered from the cache straight away and refreshed from the network in the background, so a new
// deploy shows up on the next launch. The recordings (about 12 MB) are only taken from the cache,
// never fetched again: bump CACHE to drop everything cached by an older version, and always when a
// recording changes.
const CACHE = 'polka-v2';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...SHELL, ...SOUNDS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
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
      const fresh = () =>
        fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
      if (url.pathname.includes('/sounds/')) return cached ?? fresh();
      const refreshed = fresh();
      if (!cached) return refreshed;
      event.waitUntil(refreshed.catch(() => {}));
      return cached;
    })
  );
});

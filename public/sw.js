const SHELL_CACHE = 'nova-shell-v1';
const STATIC_CACHE = 'nova-static-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nova-') && ![SHELL_CACHE, STATIC_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.protocol !== self.location.protocol) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) await caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', response.clone()));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()),
    );
    return;
  }

  const staticDestination = ['script', 'style', 'worker', 'image', 'font'].includes(request.destination);
  if (!staticDestination) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())));
      }
      return response;
    })),
  );
});

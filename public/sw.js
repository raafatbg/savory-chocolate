// Service Worker for SAVORY Standalone Progressive Web Apps (PWA)
const CACHE_NAME = 'savory-pwa-v1';

const STATIC_ASSETS = [
  '/',
  '/css/styles.css',
  '/css/admin.css',
  '/img/favicon.svg',
  '/img/logo.svg',
  '/img/cake.svg',
  '/js/common.js',
  '/js/audio.js',
  '/js/cake3d.js',
  '/js/confetti.js',
  '/js/illustrations.js',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API calls, let serverless-api / backend handle them
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Stale-while-revalidate for static files
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    }),
  );
});

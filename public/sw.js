const CACHE_NAME = 'goodyguys-cache-v1';

// Static Shell Assets to pre-cache on client device for JAMstack local execution
const PRECACHE_ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/images/real-tshirt.jpg',
  '/images/real-mug.jpg',
  '/images/real-mousepad.jpg',
  '/images/real-acrylic-cut.jpg',
  '/images/real-acrylic-engrave.jpg',
  '/images/real-keychain.jpg',
  '/images/real-lamp.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First strategy for static assets (CSS, JS, Fonts, Images)
// Network-First strategy for dynamic pages and API calls
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST /checkout, upload files)
  if (request.method !== 'GET') {
    return;
  }

  // Do not intercept admin routes
  if (url.pathname.startsWith('/admin')) {
    return;
  }

  // Static Assets (CSS, JS, Images, Fonts): Serve from local browser cache first
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/images/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version immediately from client device
          // Fetch updated version in background to refresh cache
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Pages: Network first, fall back to cached shell
  event.respondWith(
    fetch(request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return caches.match('/');
      });
    })
  );
});

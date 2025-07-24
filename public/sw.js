const CACHE_NAME = 'inventory-app-cache-v1';

// This event is fired when the service worker is first installed.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Pre-cache the main entry points. The rest will be cached on demand.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html']);
    })
  );
  self.skipWaiting();
});

// This event is fired when the service worker is activated.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // Clean up old caches.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// This event is fired for every network request.
self.addEventListener('fetch', (event) => {
  // We only handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For Supabase API calls, always go to the network.
  // We are handling data offline via IndexedDB, not the service worker cache.
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Network-first strategy for app assets.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a valid response, cache it and return it.
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If the network request fails (offline), return the cached version.
        return caches.match(event.request);
      })
  );
});
const CACHE_NAME = 'promptica-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=OpenDyslexic&display=swap',
  'https://cdn.quilljs.com/1.3.7/quill.snow.css',
  'https://cdn.quilljs.com/1.3.7/quill.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/docx@8.0.0/build/index.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
];

// Install – cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache addAll failed, retrying individually:', err);
        // Fallback: try each asset individually
        STATIC_ASSETS.forEach(url => {
          cache.add(url).catch(() => {});
        });
      });
    })
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch – network first for admin_data.json, cache first for everything else
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Special handling for admin_data.json – always try network first, fallback to cache
  if (url.pathname === '/admin_data.json') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version for offline use
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else: cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(networkResponse => {
            // Cache the network response for future offline use
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cloned);
            });
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests – serve index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('Offline – content not available', { status: 503 });
          });
      })
  );
});
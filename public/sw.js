/**
 * BAVINI Service Worker - Asset Caching
 *
 * Strategy:
 * - Cache-First for static assets (JS, CSS, images, fonts, WASM)
 * - Network-First for HTML and API calls
 * - Stale-While-Revalidate for font files
 */

const CACHE_VERSION = 'bavini-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/favicon.svg',
  '/logo.svg',
];

// File extensions to cache with Cache-First strategy
const CACHEABLE_EXTENSIONS = [
  '.js',
  '.css',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.wasm',
  '.data',
];

// Patterns to never cache
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /\/action\//,
  /\/__/, // Remix internal routes
  /\/socket/,
  /hot-update/,
  /\.map$/,
];

/**
 * Check if a URL should be cached
 */
function shouldCache(url) {
  const urlObj = new URL(url);

  // Never cache patterns
  for (const pattern of NEVER_CACHE_PATTERNS) {
    if (pattern.test(urlObj.pathname)) {
      return false;
    }
  }

  // Cache if it's a static asset
  for (const ext of CACHEABLE_EXTENSIONS) {
    if (urlObj.pathname.endsWith(ext)) {
      return true;
    }
  }

  // Cache assets from build directory
  if (urlObj.pathname.startsWith('/assets/')) {
    return true;
  }

  return false;
}

/**
 * Install event - Pre-cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete caches that don't match current version
            return cacheName.startsWith('bavini-') && !cacheName.startsWith(CACHE_VERSION);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - Cache-First for assets, Network-First for documents
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Check if this is a cacheable asset
  if (shouldCache(request.url)) {
    // Cache-First strategy for static assets
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    // Network-First for navigation (HTML pages)
    event.respondWith(networkFirst(request));
  }
  // Let other requests pass through normally
});

/**
 * Cache-First strategy
 * Return from cache if available, otherwise fetch and cache
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      // Clone the response since it can only be consumed once
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // If network fails and we have a cached version, return it
    const fallbackResponse = await caches.match(request);
    if (fallbackResponse) {
      return fallbackResponse;
    }
    throw error;
  }
}

/**
 * Network-First strategy
 * Try network first, fall back to cache
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

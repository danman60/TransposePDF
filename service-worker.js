/**
 * Service Worker for Chord Transposer Pro
 * Handles caching for offline functionality
 */

const CACHE_NAME = 'transpose-app-v1';
const CACHE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/styles/main.css',
  '/styles/mobile.css',
  '/modules/pdfProcessor.js',
  '/modules/songSeparator.js',
  '/modules/musicTheory.js',
  '/modules/pdfGenerator.js',
  '/modules/uiController.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// CDN resources to cache
const CDN_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/tonal@5.0.0/browser/tonal.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

/**
 * Service Worker Install Event
 */
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app files...');
        
        // Cache app files first
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        // Cache CDN resources separately (don't fail if CDN is down)
        return caches.open(CACHE_NAME)
          .then(cache => {
            return Promise.allSettled(
              CDN_RESOURCES.map(url => 
                cache.add(url).catch(err => {
                  console.warn(`[SW] Failed to cache CDN resource: ${url}`, err);
                })
              )
            );
          });
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        // Force activation
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Service Worker Activate Event
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old caches
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Take control of all clients
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[SW] Activation failed:', error);
      })
  );
});

/**
 * Service Worker Fetch Event
 * Strategy: Cache-first for app files, network-first for user PDFs
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip data URLs
  if (url.protocol === 'data:') {
    return;
  }
  
  event.respondWith(
    handleFetchRequest(request, url)
  );
});

/**
 * Handle fetch requests based on resource type
 */
async function handleFetchRequest(request, url) {
  try {
    // For app files and CDN resources: Cache-first strategy
    if (isAppResource(url) || isCDNResource(url)) {
      return await cacheFirstStrategy(request);
    }
    
    // For everything else: Network-first strategy
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.error('[SW] Fetch error:', error);
    
    // Fallback for navigation requests
    if (request.destination === 'document') {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/index.html') || new Response(
        '<h1>Offline</h1><p>Please check your internet connection.</p>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    // Generic offline response
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

/**
 * Check if URL is an app resource
 */
function isAppResource(url) {
  const appResources = [
    '/index.html',
    '/manifest.json',
    '/app.js',
    '/styles/',
    '/modules/',
    '/icons/'
  ];
  
  return url.origin === location.origin && 
         appResources.some(resource => url.pathname.startsWith(resource));
}

/**
 * Check if URL is a CDN resource
 */
function isCDNResource(url) {
  const cdnHosts = [
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net'
  ];
  
  return cdnHosts.includes(url.hostname);
}

/**
 * Cache-first strategy: Check cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Cache hit:', request.url);
    return cachedResponse;
  }
  
  console.log('[SW] Cache miss, fetching:', request.url);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network fetch failed:', request.url, error);
    throw error;
  }
}

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
  try {
    console.log('[SW] Network first:', request.url);
    const networkResponse = await fetch(request);
    
    // Optionally cache successful responses for future offline use
    if (networkResponse.ok && shouldCacheResponse(request)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Determine if response should be cached
 */
function shouldCacheResponse(request) {
  // Don't cache user uploaded files or large responses
  return request.url.length < 500 && 
         !request.url.includes('blob:') &&
         !request.url.includes('data:');
}

/**
 * Handle background sync for offline actions
 */
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'export-pdf') {
    event.waitUntil(handleOfflineExport());
  }
});

/**
 * Handle offline PDF export
 */
async function handleOfflineExport() {
  try {
    console.log('[SW] Handling offline export...');
    // Implementation would depend on storing export data in IndexedDB
    // For now, just log the event
  } catch (error) {
    console.error('[SW] Offline export failed:', error);
  }
}

/**
 * Handle push notifications (future feature)
 */
self.addEventListener('push', event => {
  console.log('[SW] Push event received');
  
  // Future implementation for notifications
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  // Open app
  event.waitUntil(
    clients.openWindow('/')
  );
});

/**
 * Handle messages from main thread
 */
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
        
      case 'CLEAR_CACHE':
        clearCache().then(result => {
          event.ports[0].postMessage({ success: result });
        });
        break;
        
      default:
        console.log('[SW] Unknown message type:', event.data.type);
    }
  }
});

/**
 * Clear all caches
 */
async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
    return true;
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
    return false;
  }
}

// Log service worker startup
console.log('[SW] Service Worker script loaded');

// Performance monitoring
const startTime = performance.now();
self.addEventListener('install', () => {
  const installTime = performance.now() - startTime;
  console.log(`[SW] Installation completed in ${installTime.toFixed(2)}ms`);
});

// Error handling
self.addEventListener('error', event => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});
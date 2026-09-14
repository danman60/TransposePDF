/**
 * Service Worker for Chord Transposer Pro
 * Handles caching for offline functionality
 */

const CACHE_NAME = 'transpose-app-v27';
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
  '/modules/lyricAnchor.js',
  '/modules/arrangement.js',
  '/modules/songModel.js',
  '/modules/chordPro.js',
  '/modules/correctionMemory.js',
  '/modules/libraryStore.js',
  '/modules/sessionStore.js',
  '/modules/sessionTelemetry.js',
  '/modules/observability.js',
  '/modules/performanceController.js',
  '/modules/controlBindings.js',
  '/modules/reviewQueue.js',
  '/modules/rehearsalController.js',
  '/modules/audioJobClient.js',
  '/modules/supabaseBrowserClient.js',
  '/modules/authClient.js',
  '/modules/syncStore.js',
  '/modules/teamSyncController.js',
  '/modules/serviceWorkerController.js',
  '/modules/chartRenderer.js',
  '/modules/authoringController.js',
  '/modules/workspaceController.js',
  '/companion.html',
  '/modules/companionView.js',
  '/modules/pdfGenerator.js',
  '/modules/uiController.js',
  '/vendor/pdfjs/3.11.174/pdf.min.js',
  '/vendor/pdfjs/3.11.174/pdf.worker.min.js',
  '/vendor/pdfjs/3.11.174/cmaps/manifest.json',
  '/vendor/tonal/5.0.0/tonal.min.js',
  '/vendor/jspdf/2.5.1/jspdf.umd.min.js'
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
      // PDF.js CMaps are cached on first use by the vendor cache-first route.
      // Blocking install on 169 optional files delayed editor updates for minutes.
      .then(() => console.log('[SW] Service worker installed successfully'))
      .catch(error => {
        console.error('[SW] Installation failed:', error);
        throw error;
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

  // Job state must never be cached or served stale.
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
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
    // App and pinned vendor resources use cache-first strategy.
    if (isAppResource(url)) {
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
    '/icons/',
    '/vendor/'
  ];
  
  return url.origin === location.origin && 
         appResources.some(resource => url.pathname.startsWith(resource));
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
 * Handle messages from main thread
 */
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      default:
        console.log('[SW] Unknown message type:', event.data.type);
    }
  }
});

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

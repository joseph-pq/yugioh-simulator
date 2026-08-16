/**
 * Service Worker — YGOProDeck Image Cache
 *
 * Strategy: Cache-First for card images from images.ygoprodeck.com
 * This prevents hotlinking by serving images from the browser cache
 * after the first load, dramatically reducing load on YGOProDeck servers.
 *
 * Cache is versioned so stale entries are cleared on SW update.
 */

const CACHE_NAME = 'ygoprodeck-images-v1'
const IMAGE_ORIGIN = 'https://images.ygoprodeck.com'

self.addEventListener('install', (_event) => {
  // Activate immediately without waiting for old SW to unload
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Clean up old caches from previous SW versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept image requests from YGOProDeck
  if (url.origin !== IMAGE_ORIGIN) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      // Not in cache — fetch from network, store, and return
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          cache.put(event.request, response.clone())
        }
        return response
      } catch {
        // Network failed and no cache — return a transparent 1x1 PNG
        return new Response(
          atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
          { headers: { 'Content-Type': 'image/png' } }
        )
      }
    })
  )
})

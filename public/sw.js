const SHELL_CACHE = 'gem-shell-v5'
const DATA_CACHE = 'gem-data-v5'
const CORE_FILES = ['/', '/index.html', '/manifest.webmanifest', '/icons/gem-icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png']

async function cacheAppShell() {
  const cache = await caches.open(SHELL_CACHE)
  const response = await fetch('/index.html', { cache: 'reload' })
  const html = await response.clone().text()
  const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)["?]/g)].map((match) => match[1])
  await cache.put('/index.html', response.clone())
  await cache.put('/', response)
  await cache.addAll([...CORE_FILES.slice(2), ...new Set(assetUrls)])
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, markCached = false) {
  const cache = await caches.open(cacheName)
  try {
    const networkRequest = markCached ? new Request(request, { cache: 'no-store' }) : request
    const response = await fetch(networkRequest)
    if (markCached && !response.ok) throw new Error(`API zwróciło status ${response.status}`)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) {
      if (!markCached) return cached
      const headers = new Headers(cached.headers)
      headers.set('X-GEM-Cache', 'true')
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/api/market') {
    event.respondWith(networkFirst(request, DATA_CACHE, true))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE).catch(() => caches.match('/index.html')))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok && url.pathname.startsWith('/assets/')) {
        const cache = await caches.open(SHELL_CACHE)
        await cache.put(request, response.clone())
      }
      return response
    })),
  )
})

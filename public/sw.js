export const fallbackBuildId = 'development'

export function buildIdFrom(href) {
  if (!href) {
    return fallbackBuildId
  }

  try {
    return new URL(href).searchParams.get('v') || fallbackBuildId
  } catch {
    return fallbackBuildId
  }
}

export function cacheVersionFor(buildId) {
  return `leaf-offline-${buildId}`
}

export const buildId = buildIdFrom(
  typeof self === 'undefined' ? undefined : self.location?.href,
)
export const cacheVersion = cacheVersionFor(buildId)
export const assetsCache = `${cacheVersion}-assets`
export const pagesCache = `${cacheVersion}-pages`
export const dataCache = `${cacheVersion}-data`
export const offlineUrl = '/offline'

const assetExtensions = /\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i

export function routeFor(request, url) {
  if (request.method !== 'GET') {
    return 'skip'
  }

  if (url.origin !== self.location.origin) {
    return 'skip'
  }

  if (url.pathname.startsWith('/api/')) {
    return 'skip'
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/font/') ||
    assetExtensions.test(url.pathname)
  ) {
    return 'asset'
  }

  if (request.mode === 'navigate') {
    return 'page'
  }

  if (url.searchParams.has('_rsc') || request.headers.get('rsc') === '1') {
    return 'data'
  }

  return 'skip'
}

export function isCacheable(response) {
  return Boolean(
    response &&
      response.status === 200 &&
      response.type !== 'opaqueredirect' &&
      !response.redirected,
  )
}

export function isCurrentCache(name) {
  return name === assetsCache || name === pagesCache || name === dataCache
}

async function fromCache(cacheName, request) {
  const cache = await caches.open(cacheName)

  return cache.match(request, {
    ignoreSearch: cacheName === dataCache,
    ignoreVary: true,
  })
}

async function putInCache(cacheName, request, response) {
  if (!isCacheable(response)) {
    return
  }

  const copy = response.clone()
  const cache = await caches.open(cacheName)

  await cache.put(request, copy)
}

async function cacheFirst(request) {
  const cached = await fromCache(assetsCache, request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  await putInCache(assetsCache, request, response)

  return response
}

export async function networkFirst(
  cacheName,
  request,
  fallbackUrl,
  keepAlive = (task) => task,
) {
  const response = await fetch(request).catch(() => null)

  if (response) {
    keepAlive(putInCache(cacheName, request, response).catch(() => {}))

    return response
  }

  const cached = await fromCache(cacheName, request)

  if (cached) {
    return cached
  }

  if (!fallbackUrl) {
    return Response.error()
  }

  const fallback = await fromCache(
    pagesCache,
    new Request(new URL(fallbackUrl, self.location.origin)),
  )

  return fallback ?? Response.error()
}

export function pageRequestFor(url) {
  return new Request(url, {
    credentials: 'same-origin',
    headers: { accept: 'text/html' },
  })
}

async function warmPage(url) {
  const target = new URL(url, self.location.origin)

  if (target.origin !== self.location.origin) {
    return
  }

  const request = pageRequestFor(target.href)
  const response = await fetch(request).catch(() => null)

  await putInCache(pagesCache, request, response)
}

async function precache() {
  const cache = await caches.open(pagesCache)

  await cache.add(new Request(offlineUrl, { cache: 'reload' })).catch(() => {})
}

async function dropOldCaches() {
  const names = await caches.keys()

  await Promise.all(
    names
      .filter((name) => name.startsWith('leaf-offline-') && !isCurrentCache(name))
      .map((name) => caches.delete(name)),
  )
}

async function clearEverything() {
  const names = await caches.keys()

  await Promise.all(
    names.filter((name) => name.startsWith('leaf-offline-')).map((name) => caches.delete(name)),
  )
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(precache().then(() => self.skipWaiting()))
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(dropOldCaches().then(() => self.clients.claim()))
  })

  self.addEventListener('message', (event) => {
    if (event.data?.type === 'leaf:clear-cache') {
      event.waitUntil(clearEverything())

      return
    }

    if (
      event.data?.type === 'leaf:warm-page' &&
      typeof event.data.url === 'string'
    ) {
      event.waitUntil(warmPage(event.data.url))
    }
  })

  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    const route = routeFor(event.request, url)

    if (route === 'skip') {
      return
    }

    if (route === 'asset') {
      event.respondWith(cacheFirst(event.request))

      return
    }

    const keepAlive = (task) => event.waitUntil(task)

    if (route === 'page') {
      event.respondWith(
        networkFirst(pagesCache, event.request, offlineUrl, keepAlive),
      )

      return
    }

    event.respondWith(networkFirst(dataCache, event.request, null, keepAlive))
  })
}

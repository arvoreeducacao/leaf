import { afterEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('self', { location: { origin: 'https://leaf.arvore.com.br' } })

const {
  assetsCache,
  buildIdFrom,
  cacheVersionFor,
  dataCache,
  fallbackBuildId,
  isCacheable,
  isCurrentCache,
  networkFirst,
  offlineUrl,
  pagesCache,
  routeFor,
} = await import('../../../public/sw.js')

function fakeCaches(saved: Readonly<Record<string, string>>) {
  const stored = new Map<string, Response>(
    Object.entries(saved).map(([url, body]) => [url, new Response(body)]),
  )

  const cache = {
    match: async (request: Request) => stored.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      stored.set(request.url, response.clone())
    },
  }

  vi.stubGlobal('caches', {
    open: () => new Promise((resolve) => setTimeout(() => resolve(cache), 0)),
  })

  return stored
}

function page(path: string) {
  return new Request(new URL(path, 'https://leaf.arvore.com.br'))
}

function get(
  path: string,
  init: Readonly<{ mode?: string; method?: string; rsc?: boolean }> = {},
) {
  const url = new URL(path, 'https://leaf.arvore.com.br')
  const request = {
    method: init.method ?? 'GET',
    mode: init.mode ?? 'cors',
    headers: { get: (name: string) => (init.rsc && name === 'rsc' ? '1' : null) },
  }

  return routeFor(request, url)
}

describe('service worker routing', () => {
  it('never touches the api, where auth and freshness live', () => {
    expect(get('/api/documents/abc/snapshot')).toBe('skip')
    expect(get('/api/auth/session')).toBe('skip')
  })

  it('ignores anything that is not a plain read', () => {
    expect(get('/doc/abc', { method: 'POST', mode: 'navigate' })).toBe('skip')
  })

  it('ignores other origins', () => {
    const request = {
      method: 'GET',
      mode: 'navigate',
      headers: { get: () => null },
    }

    expect(routeFor(request, new URL('https://outra.com/doc/abc'))).toBe('skip')
  })

  it('serves build output and fonts from the cache first', () => {
    expect(get('/_next/static/chunks/main.js')).toBe('asset')
    expect(get('/font/averta.woff2')).toBe('asset')
    expect(get('/_next/image?url=%2Fa.png&w=64&q=75')).toBe('asset')
    expect(get('/icon.svg')).toBe('asset')
  })

  it('treats page loads as navigations', () => {
    expect(get('/doc/abc', { mode: 'navigate' })).toBe('page')
  })

  it('treats client-side navigation payloads as data', () => {
    expect(get('/doc/abc?_rsc=1a2b3c')).toBe('data')
    expect(get('/doc/abc', { rsc: true })).toBe('data')
  })

  it('leaves everything else alone', () => {
    expect(get('/doc/abc')).toBe('skip')
  })
})

describe('service worker caching rules', () => {
  it('stores only clean successful responses', () => {
    expect(isCacheable({ status: 200, type: 'basic', redirected: false })).toBe(true)
    expect(isCacheable({ status: 404, type: 'basic', redirected: false })).toBe(false)
    expect(isCacheable({ status: 200, type: 'basic', redirected: true })).toBe(false)
    expect(isCacheable(null)).toBe(false)
  })

  it('keeps the caches of the current version and drops the rest', () => {
    expect(isCurrentCache(assetsCache)).toBe(true)
    expect(isCurrentCache(pagesCache)).toBe(true)
    expect(isCurrentCache(dataCache)).toBe(true)
    expect(isCurrentCache('leaf-offline-v0-pages')).toBe(false)
  })

  it('drops every cache a previous build left behind', () => {
    const previous = cacheVersionFor('9f1c2ab')

    expect(isCurrentCache(`${previous}-assets`)).toBe(false)
    expect(isCurrentCache(`${previous}-pages`)).toBe(false)
    expect(isCurrentCache(`${previous}-data`)).toBe(false)
  })
})

describe('service worker build identity', () => {
  it('takes the build from the script url, so each deploy owns its caches', () => {
    expect(buildIdFrom('https://leaf.arvore.com.br/sw.js?v=9f1c2ab')).toBe('9f1c2ab')
    expect(cacheVersionFor(buildIdFrom('https://leaf.arvore.com.br/sw.js?v=9f1c2ab'))).toBe(
      'leaf-offline-9f1c2ab',
    )
  })

  it('falls back when the script url carries no build', () => {
    expect(buildIdFrom('https://leaf.arvore.com.br/sw.js')).toBe(fallbackBuildId)
    expect(buildIdFrom(undefined)).toBe(fallbackBuildId)
    expect(buildIdFrom('nao-e-uma-url')).toBe(fallbackBuildId)
  })
})

describe('service worker pages on a slow or missing network', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.stubGlobal('self', { location: { origin: 'https://leaf.arvore.com.br' } })
  })

  it('waits for a slow network instead of showing the saved page', async () => {
    vi.useFakeTimers()
    fakeCaches({ 'https://leaf.arvore.com.br/doc/abc': 'saved page' })

    let answer: (response: Response) => void = () => {}

    vi.stubGlobal(
      'fetch',
      () => new Promise<Response>((resolve) => (answer = resolve)),
    )

    const served = networkFirst(pagesCache, page('/doc/abc'), offlineUrl)

    await vi.advanceTimersByTimeAsync(30_000)
    answer(new Response('fresh page'))

    expect(await (await served).text()).toBe('fresh page')
  })

  it('hands the page over before saving it, and keeps it for the next time the network fails', async () => {
    const stored = fakeCaches({})
    const saving: Array<Promise<unknown>> = []

    vi.stubGlobal('fetch', async () => new Response('fresh page'))

    const served = await networkFirst(
      pagesCache,
      page('/doc/abc'),
      offlineUrl,
      (task: Promise<unknown>) => saving.push(task),
    )

    expect(await served.text()).toBe('fresh page')
    expect(saving).toHaveLength(1)
    await Promise.all(saving)
    expect(
      await stored.get('https://leaf.arvore.com.br/doc/abc')?.text(),
    ).toBe('fresh page')
  })

  it('shows the saved page only when the network fails', async () => {
    fakeCaches({ 'https://leaf.arvore.com.br/doc/abc': 'saved page' })
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    const served = await networkFirst(pagesCache, page('/doc/abc'), offlineUrl)

    expect(await served.text()).toBe('saved page')
  })

  it('falls back to the offline screen when nothing was saved', async () => {
    fakeCaches({ 'https://leaf.arvore.com.br/offline': 'offline screen' })
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    const served = await networkFirst(pagesCache, page('/doc/abc'), offlineUrl)

    expect(await served.text()).toBe('offline screen')
  })
})

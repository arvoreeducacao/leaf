import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('self', { location: { origin: 'https://leaf.arvore.com.br' } })

const {
  assetsCache,
  buildIdFrom,
  cacheVersionFor,
  dataCache,
  fallbackBuildId,
  isCacheable,
  isCurrentCache,
  pagesCache,
  routeFor,
} = await import('../../../public/sw.js')

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

import { describe, expect, it, vi } from 'vitest'

import {
  isUnsplashDownloadLocation,
  isUnsplashEnabled,
  mapUnsplashPhoto,
  registerUnsplashDownload,
  searchUnsplashPhotos,
  unsplashAttributionUrl,
} from '@/lib/unsplash'

const photo = {
  id: 'abc',
  alt_description: 'a forest at dawn',
  color: '#264d3a',
  urls: {
    raw: 'https://images.unsplash.com/photo-1?ixid=xyz',
    small: 'https://images.unsplash.com/photo-1?w=400',
  },
  user: { name: 'Ana Silva', links: { html: 'https://unsplash.com/@ana' } },
  links: { download_location: 'https://api.unsplash.com/photos/abc/download' },
}

describe('isUnsplashEnabled', () => {
  it('turns on only with a non empty access key', () => {
    expect(isUnsplashEnabled({})).toBe(false)
    expect(isUnsplashEnabled({ UNSPLASH_ACCESS_KEY: '  ' })).toBe(false)
    expect(isUnsplashEnabled({ UNSPLASH_ACCESS_KEY: 'key' })).toBe(true)
  })
})

describe('unsplashAttributionUrl', () => {
  it('adds the referral parameters the api guidelines ask for', () => {
    expect(unsplashAttributionUrl('https://unsplash.com/@ana')).toBe(
      'https://unsplash.com/@ana?utm_source=leaf&utm_medium=referral',
    )
    expect(unsplashAttributionUrl('https://unsplash.com/?a=1')).toBe(
      'https://unsplash.com/?a=1&utm_source=leaf&utm_medium=referral',
    )
  })
})

describe('mapUnsplashPhoto', () => {
  it('keeps only what the cover needs and adds the size parameters', () => {
    expect(mapUnsplashPhoto(photo)).toEqual({
      id: 'abc',
      thumbUrl: 'https://images.unsplash.com/photo-1?w=400',
      coverUrl:
        'https://images.unsplash.com/photo-1?ixid=xyz&w=1800&q=80&auto=format&fit=max',
      alt: 'a forest at dawn',
      color: '#264d3a',
      credit: {
        name: 'Ana Silva',
        url: 'https://unsplash.com/@ana?utm_source=leaf&utm_medium=referral',
      },
      downloadLocation: 'https://api.unsplash.com/photos/abc/download',
    })
  })

  it('drops photos missing the fields the cover needs', () => {
    expect(mapUnsplashPhoto(null)).toBeNull()
    expect(mapUnsplashPhoto({ ...photo, urls: {} })).toBeNull()
    expect(
      mapUnsplashPhoto({
        ...photo,
        links: { download_location: 'https://evil.example/x' },
      }),
    ).toBeNull()
  })
})

describe('isUnsplashDownloadLocation', () => {
  it('only trusts the unsplash api host', () => {
    expect(
      isUnsplashDownloadLocation('https://api.unsplash.com/photos/abc/download'),
    ).toBe(true)
    expect(isUnsplashDownloadLocation('https://api.unsplash.com/me')).toBe(
      false,
    )
    expect(isUnsplashDownloadLocation('https://example.com/photos/a')).toBe(
      false,
    )
  })
})

describe('searchUnsplashPhotos', () => {
  it('searches with the query and maps the results', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = input instanceof URL ? input : new URL(String(input))

      expect(url.pathname).toBe('/search/photos')
      expect(init).toMatchObject({ headers: { Authorization: 'Client-ID key' } })
      expect(url.searchParams.get('query')).toBe('forest')
      expect(url.searchParams.get('page')).toBe('2')

      return new Response(
        JSON.stringify({ results: [photo, { id: 'broken' }], total_pages: 7 }),
        { status: 200 },
      )
    })

    const result = await searchUnsplashPhotos('forest', 2, 'key', fetcher)

    expect(result.photos.map((item) => item.id)).toEqual(['abc'])
    expect(result.totalPages).toBe(7)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('lists popular photos when the query is empty', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input : new URL(String(input))

      expect(url.pathname).toBe('/photos')
      expect(url.searchParams.get('order_by')).toBe('popular')

      return new Response(JSON.stringify([photo]), { status: 200 })
    })

    const result = await searchUnsplashPhotos('   ', 1, 'key', fetcher)

    expect(result.photos).toHaveLength(1)
    expect(result.totalPages).toBe(1)
  })

  it('fails loudly when unsplash answers with an error', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 403 }))

    await expect(
      searchUnsplashPhotos('forest', 1, 'key', fetcher),
    ).rejects.toThrow('403')
  })
})

describe('registerUnsplashDownload', () => {
  it('pings the download location with the client id', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))

    await expect(
      registerUnsplashDownload(
        'https://api.unsplash.com/photos/abc/download',
        'key',
        fetcher,
      ),
    ).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('never calls a host that is not the unsplash api', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))

    await expect(
      registerUnsplashDownload('https://evil.example/x', 'key', fetcher),
    ).resolves.toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

import type { CoverCredit } from '@/lib/document-cover'

export type UnsplashEnv = Readonly<Record<string, string | undefined>>

export type UnsplashPhoto = Readonly<{
  id: string
  thumbUrl: string
  coverUrl: string
  alt: string
  color: string | null
  credit: CoverCredit
  downloadLocation: string
}>

export type UnsplashSearchResult = Readonly<{
  photos: ReadonlyArray<UnsplashPhoto>
  totalPages: number
}>

const apiBase = 'https://api.unsplash.com'
const utm = 'utm_source=leaf&utm_medium=referral'

export const unsplashPerPage = 24
export const unsplashMaxQueryLength = 100

export function unsplashAccessKey(env: UnsplashEnv = process.env) {
  const key = env.UNSPLASH_ACCESS_KEY?.trim()

  return key && key.length > 0 ? key : null
}

export function isUnsplashEnabled(env: UnsplashEnv = process.env) {
  return unsplashAccessKey(env) !== null
}

export function unsplashAttributionUrl(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${utm}`
}

export const unsplashHomeUrl = unsplashAttributionUrl('https://unsplash.com/')

export function isUnsplashDownloadLocation(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(`${apiBase}/photos/`) &&
    value.length <= 500
  )
}

function coverUrlOf(raw: string) {
  return `${raw}${raw.includes('?') ? '&' : '?'}w=1800&q=80&auto=format&fit=max`
}

export function mapUnsplashPhoto(raw: unknown): UnsplashPhoto | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const photo = raw as {
    id?: unknown
    alt_description?: unknown
    description?: unknown
    color?: unknown
    urls?: { raw?: unknown; small?: unknown }
    user?: { name?: unknown; links?: { html?: unknown } }
    links?: { download_location?: unknown }
  }

  const id = photo.id
  const rawUrl = photo.urls?.raw
  const small = photo.urls?.small
  const name = photo.user?.name
  const profile = photo.user?.links?.html
  const downloadLocation = photo.links?.download_location

  if (
    typeof id !== 'string' ||
    typeof rawUrl !== 'string' ||
    typeof small !== 'string' ||
    typeof name !== 'string' ||
    typeof profile !== 'string' ||
    !isUnsplashDownloadLocation(downloadLocation)
  ) {
    return null
  }

  const alt =
    typeof photo.alt_description === 'string'
      ? photo.alt_description
      : typeof photo.description === 'string'
        ? photo.description
        : ''

  return {
    id,
    thumbUrl: small,
    coverUrl: coverUrlOf(rawUrl),
    alt,
    color: typeof photo.color === 'string' ? photo.color : null,
    credit: { name, url: unsplashAttributionUrl(profile) },
    downloadLocation,
  }
}

function headers(key: string) {
  return {
    Authorization: `Client-ID ${key}`,
    'Accept-Version': 'v1',
  }
}

export async function searchUnsplashPhotos(
  query: string,
  page: number,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<UnsplashSearchResult> {
  const trimmed = query.trim().slice(0, unsplashMaxQueryLength)
  const url = new URL(
    trimmed.length > 0 ? `${apiBase}/search/photos` : `${apiBase}/photos`,
  )

  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(unsplashPerPage))
  url.searchParams.set('orientation', 'landscape')

  if (trimmed.length > 0) {
    url.searchParams.set('query', trimmed)
  } else {
    url.searchParams.set('order_by', 'popular')
  }

  const response = await fetcher(url, { headers: headers(key) })

  if (!response.ok) {
    throw new Error(`Unsplash respondeu ${response.status}`)
  }

  const data = (await response.json()) as
    | { results?: unknown; total_pages?: unknown }
    | Array<unknown>

  const list = Array.isArray(data) ? data : data.results
  const photos = Array.isArray(list)
    ? list.map(mapUnsplashPhoto).filter((photo) => photo !== null)
    : []
  const totalPages = Array.isArray(data)
    ? photos.length === unsplashPerPage
      ? page + 1
      : page
    : typeof data.total_pages === 'number'
      ? data.total_pages
      : page

  return { photos, totalPages }
}

export async function registerUnsplashDownload(
  downloadLocation: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  if (!isUnsplashDownloadLocation(downloadLocation)) {
    return false
  }

  try {
    const response = await fetcher(downloadLocation, { headers: headers(key) })

    return response.ok
  } catch {
    return false
  }
}

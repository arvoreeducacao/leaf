export type CoverCredit = Readonly<{
  name: string
  url: string
}>

export type CoverGradient = Readonly<{
  id: string
  css: string
}>

export const coverGradients: ReadonlyArray<CoverGradient> = [
  { id: 'red', css: '#ee5c56' },
  { id: 'yellow', css: '#f8bf4f' },
  { id: 'blue', css: '#1d8dcb' },
  { id: 'cream', css: '#fdf1e6' },
  {
    id: 'teal-to-cyan',
    css: 'linear-gradient(135deg, #0fb5b0 0%, #9edbe6 100%)',
  },
  { id: 'pink', css: '#ff4fa1' },
  {
    id: 'red-to-orange',
    css: 'linear-gradient(135deg, #d92a2a 0%, #f46b2f 100%)',
  },
  {
    id: 'sky',
    css: 'linear-gradient(135deg, #a8cbe8 0%, #f6d9c9 50%, #a7c8dc 100%)',
  },
  {
    id: 'blue-to-red',
    css: 'linear-gradient(135deg, #2c5fbd 0%, #7e77b8 50%, #e0493f 100%)',
  },
  {
    id: 'purple-to-pink',
    css: 'linear-gradient(135deg, #6f2bd9 0%, #e0507a 100%)',
  },
  {
    id: 'slate',
    css: 'linear-gradient(135deg, #3a4a6b 0%, #a8b8c8 100%)',
  },
]

export const defaultCoverPosition = 50

const gradientPrefix = 'gradient:'
const maxCoverLength = 2048
const maxCreditNameLength = 120
const maxCreditUrlLength = 500
const uploadPathPrefix = '/api/uploads/'

export function gradientCoverValue(id: string) {
  return `${gradientPrefix}${id}`
}

export function gradientOfCover(cover: string | null | undefined) {
  if (!cover?.startsWith(gradientPrefix)) {
    return null
  }

  const id = cover.slice(gradientPrefix.length)

  return coverGradients.find((gradient) => gradient.id === id) ?? null
}

export function isImageCover(cover: string | null | undefined) {
  return typeof cover === 'string' && !cover.startsWith(gradientPrefix)
}

export function isHttpsImageUrl(value: string) {
  if (value.length > maxCoverLength) {
    return false
  }

  try {
    const url = new URL(value)

    return url.protocol === 'https:' && url.hostname.length > 0
  } catch {
    return false
  }
}

export function isUploadPath(value: string) {
  return (
    value.startsWith(uploadPathPrefix) &&
    !value.includes('..') &&
    value.length <= maxCoverLength
  )
}

export function normalizeCover(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (gradientOfCover(trimmed)) {
    return trimmed
  }

  if (isUploadPath(trimmed) || isHttpsImageUrl(trimmed)) {
    return trimmed
  }

  return null
}

export function randomGradientCover(random: () => number = Math.random) {
  const index = Math.min(
    coverGradients.length - 1,
    Math.floor(random() * coverGradients.length),
  )

  return gradientCoverValue(coverGradients[index]?.id ?? 'blue')
}

export function clampCoverPosition(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(number)) {
    return defaultCoverPosition
  }

  return Math.min(100, Math.max(0, Math.round(number)))
}

export function normalizeCoverCredit(value: unknown): CoverCredit | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const { name, url } = value as { name?: unknown; url?: unknown }

  if (typeof name !== 'string' || typeof url !== 'string') {
    return null
  }

  const trimmedName = name.trim().slice(0, maxCreditNameLength)
  const trimmedUrl = url.trim()

  if (
    trimmedName.length === 0 ||
    trimmedUrl.length > maxCreditUrlLength ||
    !isHttpsImageUrl(trimmedUrl)
  ) {
    return null
  }

  return { name: trimmedName, url: trimmedUrl }
}

export function parseCoverCredit(raw: string | null | undefined) {
  if (!raw) {
    return null
  }

  try {
    return normalizeCoverCredit(JSON.parse(raw))
  } catch {
    return null
  }
}

export function serializeCoverCredit(credit: CoverCredit | null) {
  return credit ? JSON.stringify(credit) : null
}

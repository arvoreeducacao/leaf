const avatarPathPrefix = '/api/avatar/'
const uploadPathPrefix = '/api/uploads/'
const maxAvatarUrlLength = 1024
const seedShape = /^[a-z0-9-]{1,64}$/

export const avatarGallerySeeds = [
  'acorn',
  'basil',
  'cedar',
  'clover',
  'daisy',
  'fern',
  'ginkgo',
  'ivy',
  'juniper',
  'laurel',
  'maple',
  'olive',
  'poppy',
  'sage',
  'thyme',
  'willow',
] as const

export function isAvatarSeed(value: string): boolean {
  return seedShape.test(value)
}

function hashOf(value: string, offset: number): number {
  let hash = offset

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }

  return hash
}

export function avatarSeedForUser(userId: string): string {
  const head = hashOf(userId, 2166136261)
  const tail = hashOf(`${userId}:leaf`, 271828183)

  return `${head.toString(36)}${tail.toString(36)}`
}

export function generatedAvatarUrl(seed: string): string {
  return `${avatarPathPrefix}${seed}`
}

export function isGeneratedAvatarUrl(value: string): boolean {
  return (
    value.startsWith(avatarPathPrefix) &&
    isAvatarSeed(value.slice(avatarPathPrefix.length))
  )
}

function isUploadedAvatarUrl(value: string): boolean {
  return (
    value.startsWith(uploadPathPrefix) &&
    !value.includes('..') &&
    value.length <= maxAvatarUrlLength
  )
}

function httpsAvatarUrl(value: string): string | null {
  if (value.length > maxAvatarUrlLength) {
    return null
  }

  try {
    const url = new URL(value)

    return url.protocol === 'https:' && url.hostname.length > 0 ? value : null
  } catch {
    return null
  }
}

export function normalizeAvatar(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  if (trimmed.startsWith('/')) {
    return isGeneratedAvatarUrl(trimmed) || isUploadedAvatarUrl(trimmed)
      ? trimmed
      : null
  }

  return httpsAvatarUrl(trimmed)
}

export function avatarUrlFor(
  userId: string,
  image: string | null | undefined,
): string {
  return normalizeAvatar(image) ?? generatedAvatarUrl(avatarSeedForUser(userId))
}

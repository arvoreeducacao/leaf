import { describe, expect, it } from 'vitest'

import {
  avatarGallerySeeds,
  avatarSeedForUser,
  avatarUrlFor,
  generatedAvatarUrl,
  isAvatarSeed,
  isGeneratedAvatarUrl,
  normalizeAvatar,
} from '@/lib/avatar'

describe('avatarSeedForUser', () => {
  it('gives the same seed to the same person', () => {
    expect(avatarSeedForUser('sJp0Kx')).toBe(avatarSeedForUser('sJp0Kx'))
  })

  it('gives different seeds to different people', () => {
    expect(avatarSeedForUser('sJp0Kx')).not.toBe(avatarSeedForUser('sJp0Ky'))
  })

  it('never leaks the user id into the seed', () => {
    expect(avatarSeedForUser('ana.ribeiro')).not.toContain('ana')
  })

  it('produces a seed the route accepts', () => {
    expect(isAvatarSeed(avatarSeedForUser('sJp0Kx'))).toBe(true)
  })
})

describe('isAvatarSeed', () => {
  it('accepts the gallery seeds', () => {
    for (const seed of avatarGallerySeeds) {
      expect(isAvatarSeed(seed)).toBe(true)
    }
  })

  it('refuses a path traversal', () => {
    expect(isAvatarSeed('../../etc/passwd')).toBe(false)
  })

  it('refuses an empty seed', () => {
    expect(isAvatarSeed('')).toBe(false)
  })
})

describe('normalizeAvatar', () => {
  it('keeps a generated avatar path', () => {
    expect(normalizeAvatar('/api/avatar/maple')).toBe('/api/avatar/maple')
  })

  it('keeps an uploaded image path', () => {
    expect(normalizeAvatar('/api/uploads/u/abc123.png')).toBe(
      '/api/uploads/u/abc123.png',
    )
  })

  it('keeps an https url', () => {
    expect(normalizeAvatar('https://files.example.com/me.png')).toBe(
      'https://files.example.com/me.png',
    )
  })

  it('refuses http', () => {
    expect(normalizeAvatar('http://files.example.com/me.png')).toBeNull()
  })

  it('refuses a path that escapes the upload folder', () => {
    expect(normalizeAvatar('/api/uploads/../../etc/passwd')).toBeNull()
  })

  it('refuses any other local path', () => {
    expect(normalizeAvatar('/api/documents/1')).toBeNull()
  })

  it('reads blank and missing values as no avatar', () => {
    expect(normalizeAvatar('   ')).toBeNull()
    expect(normalizeAvatar(null)).toBeNull()
    expect(normalizeAvatar(undefined)).toBeNull()
  })
})

describe('avatarUrlFor', () => {
  it('falls back to the drawn face when the person never chose one', () => {
    expect(avatarUrlFor('sJp0Kx', null)).toBe(
      generatedAvatarUrl(avatarSeedForUser('sJp0Kx')),
    )
  })

  it('falls back to the drawn face when the stored value is junk', () => {
    expect(avatarUrlFor('sJp0Kx', 'javascript:alert(1)')).toBe(
      generatedAvatarUrl(avatarSeedForUser('sJp0Kx')),
    )
  })

  it('uses the picture the person chose', () => {
    expect(avatarUrlFor('sJp0Kx', '/api/uploads/u/abc123.png')).toBe(
      '/api/uploads/u/abc123.png',
    )
  })
})

describe('isGeneratedAvatarUrl', () => {
  it('tells a drawn face from an uploaded picture', () => {
    expect(isGeneratedAvatarUrl('/api/avatar/maple')).toBe(true)
    expect(isGeneratedAvatarUrl('/api/uploads/u/abc123.png')).toBe(false)
  })
})

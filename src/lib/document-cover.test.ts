import { describe, expect, it } from 'vitest'

import {
  clampCoverPosition,
  coverGradients,
  gradientCoverValue,
  gradientOfCover,
  isImageCover,
  normalizeCover,
  normalizeCoverCredit,
  parseCoverCredit,
  randomGradientCover,
  serializeCoverCredit,
} from '@/lib/document-cover'

describe('normalizeCover', () => {
  it('accepts every gradient of the gallery', () => {
    for (const gradient of coverGradients) {
      const value = gradientCoverValue(gradient.id)

      expect(normalizeCover(value)).toBe(value)
      expect(gradientOfCover(value)).toEqual(gradient)
    }
  })

  it('rejects a gradient that is not in the gallery', () => {
    expect(normalizeCover('gradient:neon')).toBeNull()
    expect(gradientOfCover('gradient:neon')).toBeNull()
  })

  it('accepts https image urls and the app upload path', () => {
    expect(normalizeCover('https://images.unsplash.com/photo-1?w=1800')).toBe(
      'https://images.unsplash.com/photo-1?w=1800',
    )
    expect(normalizeCover('  /api/uploads/u/abc.jpg ')).toBe(
      '/api/uploads/u/abc.jpg',
    )
  })

  it('rejects anything that is not https, upload or gradient', () => {
    expect(normalizeCover('http://example.com/a.jpg')).toBeNull()
    expect(normalizeCover('javascript:alert(1)')).toBeNull()
    expect(normalizeCover('data:image/png;base64,AAAA')).toBeNull()
    expect(normalizeCover('/api/uploads/../auth')).toBeNull()
    expect(normalizeCover('')).toBeNull()
    expect(normalizeCover(42)).toBeNull()
    expect(normalizeCover(`https://a.com/${'x'.repeat(2100)}`)).toBeNull()
  })

  it('tells images apart from gradients', () => {
    expect(isImageCover('https://a.com/a.jpg')).toBe(true)
    expect(isImageCover('gradient:red')).toBe(false)
    expect(isImageCover(null)).toBe(false)
  })

  it('draws a random gradient from the gallery', () => {
    expect(randomGradientCover(() => 0)).toBe(
      gradientCoverValue(coverGradients[0]!.id),
    )
    expect(randomGradientCover(() => 0.999)).toBe(
      gradientCoverValue(coverGradients.at(-1)!.id),
    )
  })
})

describe('clampCoverPosition', () => {
  it('keeps the position between 0 and 100 as an integer', () => {
    expect(clampCoverPosition(42.6)).toBe(43)
    expect(clampCoverPosition(-10)).toBe(0)
    expect(clampCoverPosition(180)).toBe(100)
    expect(clampCoverPosition('25')).toBe(25)
  })

  it('falls back to the center when the value makes no sense', () => {
    expect(clampCoverPosition('abc')).toBe(50)
    expect(clampCoverPosition(undefined)).toBe(50)
    expect(clampCoverPosition(Number.NaN)).toBe(50)
  })
})

describe('cover credit', () => {
  it('keeps name and https profile url', () => {
    expect(
      normalizeCoverCredit({
        name: '  Ana Silva ',
        url: 'https://unsplash.com/@ana?utm_source=leaf',
      }),
    ).toEqual({
      name: 'Ana Silva',
      url: 'https://unsplash.com/@ana?utm_source=leaf',
    })
  })

  it('drops credits with no name or with a non https url', () => {
    expect(normalizeCoverCredit({ name: '', url: 'https://a.com' })).toBeNull()
    expect(normalizeCoverCredit({ name: 'A', url: 'http://a.com' })).toBeNull()
    expect(normalizeCoverCredit(null)).toBeNull()
    expect(normalizeCoverCredit('x')).toBeNull()
  })

  it('round trips through the stored column', () => {
    const credit = { name: 'Ana', url: 'https://unsplash.com/@ana' }

    expect(parseCoverCredit(serializeCoverCredit(credit))).toEqual(credit)
    expect(serializeCoverCredit(null)).toBeNull()
    expect(parseCoverCredit(null)).toBeNull()
    expect(parseCoverCredit('{not json')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import {
  decodeBase64,
  looksLikeType,
  sanitizeSvg,
  uploadKey,
  uploadUrl,
} from '@/lib/uploads'

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

const webp = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
  Buffer.from([0x56, 0x50, 0x38, 0x20]),
])

describe('uploadKey', () => {
  it('names the file by its type, and never by what the caller sent', () => {
    expect(uploadKey('image/png')).toMatch(/^u\/[\w-]{16}\.png$/)
    expect(uploadKey('image/jpeg')).toMatch(/\.jpg$/)
    expect(uploadKey('application/x-msdownload')).toMatch(/\.bin$/)
    expect(uploadKey('image/png')).not.toBe(uploadKey('image/png'))
    expect(uploadUrl('u/abc.png')).toBe('/api/uploads/u/abc.png')
  })
})

describe('decodeBase64', () => {
  it('accepts base64 with line breaks, which is how a big image arrives', () => {
    const packed = png.toString('base64')
    const broken = `${packed.slice(0, 8)}\n  ${packed.slice(8)}`

    expect(decodeBase64(broken)?.equals(png)).toBe(true)
  })

  it('refuses what is not base64, instead of quietly dropping the bad characters', () => {
    expect(decodeBase64('')).toBeNull()
    expect(decodeBase64('   ')).toBeNull()
    expect(decodeBase64('não é base64!')).toBeNull()
    expect(decodeBase64('iVBORw0KGgo')).toBeNull()
    expect(decodeBase64('data:image/png;base64,iVBORw0KGgo=')).toBeNull()
  })
})

describe('looksLikeType', () => {
  it('reads the first bytes, so a renamed file cannot pass as an image', () => {
    expect(looksLikeType(png, 'image/png')).toBe(true)
    expect(looksLikeType(jpeg, 'image/jpeg')).toBe(true)
    expect(looksLikeType(webp, 'image/webp')).toBe(true)
    expect(looksLikeType(Buffer.from('GIF89a...', 'latin1'), 'image/gif')).toBe(true)
  })

  it('refuses bytes that disagree with the type they claim', () => {
    expect(looksLikeType(png, 'image/jpeg')).toBe(false)
    expect(looksLikeType(jpeg, 'image/png')).toBe(false)
    expect(looksLikeType(Buffer.from('<svg><script/></svg>'), 'image/png')).toBe(false)
    expect(looksLikeType(Buffer.from('MZ'), 'image/webp')).toBe(false)
    expect(looksLikeType(Buffer.alloc(0), 'image/png')).toBe(false)
  })
})

describe('sanitizeSvg', () => {
  const diagram = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">',
    '<rect x="0" y="0" width="40" height="20" fill="#CD694A"/>',
    '<text x="4" y="14">estante</text>',
    '<use href="#seta"/>',
    '<a href="https://leaf.example.com/doc/1"><text>o documento</text></a>',
    '</svg>',
  ].join('')

  it('keeps the drawing whole', () => {
    const safe = sanitizeSvg(diagram)

    expect(safe).toContain('viewBox="0 0 100 40"')
    expect(safe).toContain('#CD694A')
    expect(safe).toContain('estante')
    expect(safe).toContain('href="#seta"')
    expect(safe).toContain('https://leaf.example.com/doc/1')
  })

  it('takes out the script, the handler and the javascript link', () => {
    const safe = sanitizeSvg(
      [
        '<svg viewBox="0 0 10 10" onload="roubar()">',
        '<script>fetch("https://example.com")</script>',
        '<foreignObject><body onclick="x()">html</body></foreignObject>',
        '<a href="javascript:alert(1)"><text>clique</text></a>',
        '<text>o desenho fica</text>',
        '</svg>',
      ].join(''),
    )

    expect(safe).not.toContain('onload')
    expect(safe).not.toContain('fetch(')
    expect(safe).not.toContain('foreignObject')
    expect(safe).not.toContain('onclick')
    expect(safe).not.toContain('javascript:')
    expect(safe).toContain('o desenho fica')
  })
})

describe('looksLikeType for svg', () => {
  it('accepts a real svg, with or without the xml prologue', () => {
    expect(looksLikeType(Buffer.from('<svg viewBox="0 0 1 1"></svg>'), 'image/svg+xml')).toBe(true)
    expect(
      looksLikeType(Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>'), 'image/svg+xml'),
    ).toBe(true)
    expect(looksLikeType(Buffer.from('  \n<svg/>'), 'image/svg+xml')).toBe(true)
  })

  it('refuses html and text dressed as svg', () => {
    expect(looksLikeType(Buffer.from('<html><svg/></html>'), 'image/svg+xml')).toBe(false)
    expect(looksLikeType(Buffer.from('só um texto'), 'image/svg+xml')).toBe(false)
    expect(looksLikeType(Buffer.from('<?xml version="1.0"?><rss/>'), 'image/svg+xml')).toBe(false)
  })
})

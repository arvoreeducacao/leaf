import { describe, expect, it } from 'vitest'

import { iconPackFile, parseIconPack, searchIconPack } from '@/lib/icon-pack'

const manifest = {
  name: 'Gallery',
  colors: [
    { id: 'gray', label: 'Gray', swatch: '#91918e' },
    { id: 'green', swatch: 'not-a-color' },
    'blue',
  ],
  icons: [
    {
      name: 'attachment',
      tags: ['clip', 'file'],
      files: {
        gray: '/api/uploads/icon-packs/gallery/attachment_gray.svg',
        green: 'https://cdn.example.com/attachment_green.svg',
      },
    },
    {
      name: 'arrow-up',
      files: { blue: 'https://cdn.example.com/arrow-up_blue.svg' },
    },
  ],
}

describe('parseIconPack', () => {
  it('reads colors, icons and tags', () => {
    const pack = parseIconPack(manifest)

    expect(pack?.name).toBe('Gallery')
    expect(pack?.colors).toEqual([
      { id: 'gray', label: 'Gray', swatch: '#91918e' },
      { id: 'green', label: 'green', swatch: null },
      { id: 'blue', label: 'blue', swatch: null },
    ])
    expect(pack?.icons.map((icon) => icon.name)).toEqual(['attachment', 'arrow-up'])
    expect(pack?.icons[0].tags).toEqual(['clip', 'file'])
    expect(pack?.icons[1].tags).toEqual([])
  })

  it('drops files that are not safe icon images or use an unknown color', () => {
    const pack = parseIconPack({
      colors: ['gray'],
      icons: [
        {
          name: 'bad',
          files: {
            gray: 'javascript:alert(1)',
            red: 'https://cdn.example.com/bad_red.svg',
          },
        },
        {
          name: 'plain-http',
          files: { gray: 'http://cdn.example.com/plain.svg' },
        },
        {
          name: 'outside-uploads',
          files: { gray: '/etc/passwd' },
        },
        { name: 'ok', files: { gray: 'https://cdn.example.com/ok.svg' } },
      ],
    })

    expect(pack?.icons.map((icon) => icon.name)).toEqual(['ok'])
  })

  it('rejects invalid names and keeps the first of duplicated icons', () => {
    const pack = parseIconPack({
      colors: ['gray'],
      icons: [
        { name: '../x', files: { gray: 'https://a.example.com/1.svg' } },
        { name: 'dup', files: { gray: 'https://a.example.com/2.svg' } },
        { name: 'dup', files: { gray: 'https://a.example.com/3.svg' } },
      ],
    })

    expect(pack?.icons).toEqual([
      { name: 'dup', tags: [], files: { gray: 'https://a.example.com/2.svg' } },
    ])
  })

  it('returns null for a manifest without colors or usable icons', () => {
    expect(parseIconPack(null)).toBeNull()
    expect(parseIconPack({ colors: [], icons: manifest.icons })).toBeNull()
    expect(parseIconPack({ colors: ['gray'], icons: [] })).toBeNull()
    expect(parseIconPack({ colors: ['gray'], icons: 'nope' })).toBeNull()
  })
})

describe('iconPackFile', () => {
  const pack = parseIconPack(manifest)!

  it('uses the file for the chosen color', () => {
    expect(iconPackFile(pack.icons[0], 'green', pack.colors)).toBe(
      'https://cdn.example.com/attachment_green.svg',
    )
  })

  it('falls back to the first color the icon has, in pack order', () => {
    expect(iconPackFile(pack.icons[0], 'blue', pack.colors)).toBe(
      '/api/uploads/icon-packs/gallery/attachment_gray.svg',
    )
    expect(iconPackFile(pack.icons[1], 'gray', pack.colors)).toBe(
      'https://cdn.example.com/arrow-up_blue.svg',
    )
  })
})

describe('searchIconPack', () => {
  const pack = parseIconPack(manifest)!

  it('returns every icon for an empty query', () => {
    expect(searchIconPack(pack.icons, '  ')).toHaveLength(2)
  })

  it('matches names with dashes as words and tags', () => {
    expect(searchIconPack(pack.icons, 'arrow up').map((i) => i.name)).toEqual([
      'arrow-up',
    ])
    expect(searchIconPack(pack.icons, 'CLIP').map((i) => i.name)).toEqual([
      'attachment',
    ])
  })

  it('requires every term to match', () => {
    expect(searchIconPack(pack.icons, 'clip arrow')).toEqual([])
  })
})

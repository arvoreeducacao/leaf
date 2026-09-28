import { describe, expect, it, vi } from 'vitest'

import { createIconPackLoader, iconPackSource } from '@/lib/icon-pack-source'

const manifest = JSON.stringify({
  colors: ['gray'],
  icons: [{ name: 'star', files: { gray: 'https://cdn.example.com/star.svg' } }],
})

describe('iconPackSource', () => {
  it('is off without the variable', () => {
    expect(iconPackSource({})).toBeNull()
    expect(iconPackSource({ LEAF_ICON_PACK_URL: '  ' })).toBeNull()
  })

  it('reads a path inside the uploads storage', () => {
    expect(
      iconPackSource({ LEAF_ICON_PACK_URL: '/api/uploads/icon-packs/gallery/manifest.json' }),
    ).toEqual({ kind: 'storage', key: 'icon-packs/gallery/manifest.json' })
  })

  it('reads an https address', () => {
    expect(
      iconPackSource({ LEAF_ICON_PACK_URL: 'https://cdn.example.com/pack.json' }),
    ).toEqual({ kind: 'url', url: 'https://cdn.example.com/pack.json' })
  })

  it('refuses other schemes and paths', () => {
    expect(iconPackSource({ LEAF_ICON_PACK_URL: 'http://cdn.example.com/p.json' })).toBeNull()
    expect(iconPackSource({ LEAF_ICON_PACK_URL: 'file:///etc/passwd' })).toBeNull()
    expect(iconPackSource({ LEAF_ICON_PACK_URL: '/api/uploads/../secret' })).toBeNull()
    expect(iconPackSource({ LEAF_ICON_PACK_URL: '/etc/passwd' })).toBeNull()
  })
})

describe('createIconPackLoader', () => {
  const env = { LEAF_ICON_PACK_URL: 'https://cdn.example.com/pack.json' }

  it('returns null without loading when the pack is off', async () => {
    const load = vi.fn()
    const loadIconPack = createIconPackLoader(load)

    expect(await loadIconPack({})).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('caches the parsed pack until it goes stale', async () => {
    let clock = 0
    const load = vi.fn(async () => manifest)
    const loadIconPack = createIconPackLoader(load, () => clock)

    const first = await loadIconPack(env)

    expect(first?.icons[0].name).toBe('star')
    await loadIconPack(env)
    expect(load).toHaveBeenCalledTimes(1)

    clock += 11 * 60 * 1000
    await loadIconPack(env)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('shares one load between concurrent callers', async () => {
    const load = vi.fn(async () => manifest)
    const loadIconPack = createIconPackLoader(load, () => 0)

    await Promise.all([loadIconPack(env), loadIconPack(env), loadIconPack(env)])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good pack when a refresh fails', async () => {
    let clock = 0
    const load = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(manifest)
      .mockRejectedValueOnce(new Error('down'))
    const loadIconPack = createIconPackLoader(load, () => clock)

    await loadIconPack(env)
    clock += 11 * 60 * 1000

    expect((await loadIconPack(env))?.icons).toHaveLength(1)
  })

  it('returns null for a broken manifest', async () => {
    const loadIconPack = createIconPackLoader(async () => '{not json', () => 0)

    expect(await loadIconPack(env)).toBeNull()
  })
})

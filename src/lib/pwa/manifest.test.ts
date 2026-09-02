import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

type ManifestIcon = Readonly<{
  src: string
  sizes: string
  type: string
  purpose?: string
}>

type Manifest = Readonly<{
  id: string
  start_url: string
  scope: string
  display: string
  icons: Array<ManifestIcon>
}>

const publicDir = join(process.cwd(), 'public')
const manifest = JSON.parse(
  readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'),
) as Manifest

function pngDimensions(file: string) {
  const bytes = readFileSync(join(publicDir, file))

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

function pngIcons(purpose: string) {
  return manifest.icons.filter(
    (icon) => icon.type === 'image/png' && (icon.purpose ?? 'any') === purpose,
  )
}

describe('web app manifest', () => {
  it('has a stable id inside its own scope', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    expect(manifest.display).toBe('standalone')
  })

  it('ships every icon it points to', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(publicDir, icon.src)), icon.src).toBe(true)
    }
  })

  it('has the 192 and 512 PNG icons the install prompt needs', () => {
    const sizes = pngIcons('any').map((icon) => icon.sizes)

    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('has a maskable icon of at least 512px', () => {
    const [maskable] = pngIcons('maskable')

    expect(maskable).toBeDefined()
    expect(pngDimensions(maskable.src)).toEqual({ width: 512, height: 512 })
  })

  it('declares sizes that match the files', () => {
    for (const icon of pngIcons('any')) {
      const [width, height] = icon.sizes.split('x').map(Number)

      expect(pngDimensions(icon.src)).toEqual({ width, height })
    }
  })

  it('ships the apple touch icon Safari reads instead of the manifest', () => {
    expect(pngDimensions('apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
  })
})

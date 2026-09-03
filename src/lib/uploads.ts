import { nanoid } from 'nanoid'

import { sanitizeUrl } from '@/lib/markdown/sanitize'
import { storage } from '@/lib/storage'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const uploadExtensionByType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

const magicByType: Record<string, ReadonlyArray<ReadonlyArray<number>>> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
}

const base64Shape = /^[A-Za-z0-9+/]+={0,2}$/

export function uploadKey(contentType: string) {
  return `u/${nanoid(16)}.${uploadExtensionByType[contentType] ?? 'bin'}`
}

export function uploadUrl(key: string) {
  return `/api/uploads/${key}`
}

export async function storeUpload(bytes: Buffer, contentType: string) {
  const key = uploadKey(contentType)

  await storage.put(key, bytes, contentType)

  return { key, url: uploadUrl(key) }
}

export function decodeBase64(data: string): Buffer | null {
  const packed = data.replace(/\s+/g, '')

  if (packed.length === 0 || packed.length % 4 !== 0 || !base64Shape.test(packed)) {
    return null
  }

  const bytes = Buffer.from(packed, 'base64')

  return bytes.length > 0 ? bytes : null
}

export function looksLikeType(bytes: Buffer, contentType: string) {
  const starts = magicByType[contentType]

  if (!starts) {
    return (
      isRiffImage(bytes, contentType) ||
      isIsoImage(bytes, contentType) ||
      isSvg(bytes, contentType)
    )
  }

  return starts.some((magic) =>
    magic.every((byte, index) => bytes[index] === byte),
  )
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\s*(script|foreignObject)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|foreignObject|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(\s(?:href|xlink:href)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (match, prefix: string, raw: string) => {
        const quoted = raw.startsWith('"') || raw.startsWith("'")
        const value = (quoted ? raw.slice(1, -1) : raw).trim()

        if (value.startsWith('#')) {
          return match
        }

        return sanitizeUrl(value).length > 0 ? match : `${prefix}""`
      },
    )
}

function isSvg(bytes: Buffer, contentType: string) {
  if (contentType !== 'image/svg+xml') {
    return false
  }

  const head = bytes.subarray(0, 512).toString('utf8').trimStart()

  return /^<(\?xml|!doctype svg|svg)\b/i.test(head) && /<svg\b/i.test(head)
}

function isRiffImage(bytes: Buffer, contentType: string) {
  return (
    contentType === 'image/webp' &&
    bytes.length > 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  )
}

function isIsoImage(bytes: Buffer, contentType: string) {
  return (
    contentType === 'image/avif' &&
    bytes.length > 12 &&
    bytes.subarray(4, 8).toString('latin1') === 'ftyp'
  )
}

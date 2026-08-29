import { unzipSync } from 'fflate'

import {
  MAX_UNZIPPED_BYTES,
  MAX_UNZIPPED_LABEL,
  MAX_ZIP_ENTRIES,
} from '@/lib/notion/limits'
import type { NotionImportMessages } from '@/lib/notion/messages'

export class NotionImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotionImportError'
  }
}

export type ZipEntry = Readonly<{
  path: string
  bytes: Uint8Array
}>

const ignoredPrefixes = ['__MACOSX/']

const ignoredNames = ['.DS_Store', 'Thumbs.db']

export function normalizeZipPath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function isSafeZipPath(path: string): boolean {
  if (path.length === 0) {
    return false
  }

  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return false
  }

  return !path.split('/').some((segment) => segment === '..')
}

function isIgnored(path: string) {
  if (ignoredPrefixes.some((prefix) => path.startsWith(prefix))) {
    return true
  }

  const name = path.split('/').pop() ?? ''

  return name.length === 0 || ignoredNames.includes(name) || name.startsWith('._')
}

export type ZipLimits = Readonly<{
  maxEntries?: number
  maxBytes?: number
}>

export function readZipEntries(
  data: Uint8Array,
  messages: NotionImportMessages,
  limits: ZipLimits = {},
): Array<ZipEntry> {
  const maxEntries = limits.maxEntries ?? MAX_ZIP_ENTRIES
  const maxBytes = limits.maxBytes ?? MAX_UNZIPPED_BYTES
  const maxBytesLabel =
    maxBytes === MAX_UNZIPPED_BYTES
      ? MAX_UNZIPPED_LABEL
      : `${Math.round(maxBytes / 1024)} KB`

  let entryCount = 0
  let declaredBytes = 0

  const files = unzipSync(data, {
    filter: (file) => {
      const path = normalizeZipPath(file.name)

      if (!isSafeZipPath(path)) {
        throw new NotionImportError(messages.unsafePaths)
      }

      if (path.endsWith('/') || isIgnored(path)) {
        return false
      }

      entryCount += 1

      if (entryCount > maxEntries) {
        throw new NotionImportError(messages.tooManyEntries(maxEntries))
      }

      declaredBytes += file.originalSize

      if (declaredBytes > maxBytes) {
        throw new NotionImportError(
          messages.unzippedTooLarge(maxBytesLabel),
        )
      }

      return true
    },
  })

  let extractedBytes = 0

  return Object.entries(files).map(([rawPath, bytes]) => {
    extractedBytes += bytes.byteLength

    if (extractedBytes > maxBytes) {
      throw new NotionImportError(messages.unzippedTooLarge(maxBytesLabel))
    }

    return { path: normalizeZipPath(rawPath), bytes }
  })
}

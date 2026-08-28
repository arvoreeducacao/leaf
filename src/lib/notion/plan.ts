import {
  baseNameOf,
  directoryOf,
  extensionOf,
  notionTitle,
  stripCommonRoot,
} from '@/lib/notion/paths'
import type { ZipEntry } from '@/lib/notion/zip'

const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd'])

const imageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
])

const contentTypeByExtension: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.csv': 'text/csv',
}

export type NotionPageKind = 'markdown' | 'csv' | 'folder'

export type NotionPage = Readonly<{
  key: string
  title: string
  parentKey: string | null
  kind: NotionPageKind
  sourcePath: string | null
}>

export type NotionAsset = Readonly<{
  path: string
  bytes: Uint8Array
  isImage: boolean
  contentType: string
  fileName: string
}>

export type NotionPlan = Readonly<{
  pages: Array<NotionPage>
  assets: Array<NotionAsset>
  pathToPageKey: Map<string, string>
  markdownByPath: Map<string, string>
  csvByPath: Map<string, string>
}>

export function contentTypeOf(path: string): string {
  return contentTypeByExtension[extensionOf(path)] ?? 'application/octet-stream'
}

export function isImagePath(path: string): boolean {
  return imageExtensions.has(extensionOf(path))
}

function shouldStripRoot(prefix: string) {
  if (prefix.length === 0) {
    return false
  }

  return !/[0-9a-f]{32}/i.test(prefix)
}

export function buildImportPlan(entries: Array<ZipEntry>): NotionPlan {
  const prefix = stripCommonRoot(entries.map((entry) => entry.path))
  const strip = shouldStripRoot(prefix)

  const normalized = entries
    .map((entry) => ({
      ...entry,
      path: strip ? entry.path.slice(prefix.length) : entry.path,
    }))
    .filter((entry) => entry.path.length > 0)

  const decoder = new TextDecoder('utf-8')
  const markdownByPath = new Map<string, string>()
  const csvByPath = new Map<string, string>()
  const assets: Array<NotionAsset> = []

  for (const entry of normalized) {
    const extension = extensionOf(entry.path)

    if (markdownExtensions.has(extension)) {
      markdownByPath.set(entry.path, decoder.decode(entry.bytes))
      continue
    }

    if (extension === '.csv') {
      csvByPath.set(entry.path, decoder.decode(entry.bytes))
      continue
    }

    assets.push({
      path: entry.path,
      bytes: entry.bytes,
      isImage: isImagePath(entry.path),
      contentType: contentTypeOf(entry.path),
      fileName: baseNameOf(entry.path),
    })
  }

  const markdownByBase = new Map<string, string>()

  for (const path of markdownByPath.keys()) {
    markdownByBase.set(path.slice(0, path.length - extensionOf(path).length), path)
  }

  const csvByBase = new Map<string, string>()

  for (const path of csvByPath.keys()) {
    csvByBase.set(path.slice(0, path.length - extensionOf(path).length), path)
  }

  const pages = new Map<string, NotionPage>()
  const directoryKeys = new Map<string, string | null>()

  function addPage(page: NotionPage) {
    if (!pages.has(page.key)) {
      pages.set(page.key, page)
    }

    return page.key
  }

  function keyForDirectory(directory: string): string | null {
    if (directory.length === 0) {
      return null
    }

    const cached = directoryKeys.get(directory)

    if (cached !== undefined) {
      return cached
    }

    directoryKeys.set(directory, null)

    const markdownPath = markdownByBase.get(directory)

    if (markdownPath) {
      const key = keyForMarkdown(markdownPath)
      directoryKeys.set(directory, key)

      return key
    }

    const csvPath = csvByBase.get(directory)

    if (csvPath) {
      const key = keyForCsv(csvPath)
      directoryKeys.set(directory, key)

      return key
    }

    const key = addPage({
      key: `${directory}/`,
      title: notionTitle(directory),
      parentKey: keyForDirectory(directoryOf(directory)),
      kind: 'folder',
      sourcePath: null,
    })

    directoryKeys.set(directory, key)

    return key
  }

  function keyForMarkdown(path: string): string {
    return addPage({
      key: path,
      title: notionTitle(path),
      parentKey: keyForDirectory(directoryOf(path)),
      kind: 'markdown',
      sourcePath: path,
    })
  }

  function keyForCsv(path: string): string {
    return addPage({
      key: path,
      title: notionTitle(path),
      parentKey: keyForDirectory(directoryOf(path)),
      kind: 'csv',
      sourcePath: path,
    })
  }

  for (const path of markdownByPath.keys()) {
    keyForMarkdown(path)
  }

  for (const path of csvByPath.keys()) {
    keyForCsv(path)
  }

  for (const asset of assets) {
    keyForDirectory(directoryOf(asset.path))
  }

  const pathToPageKey = new Map<string, string>()

  for (const page of pages.values()) {
    if (page.sourcePath) {
      pathToPageKey.set(page.sourcePath, page.key)
    }
  }

  for (const [directory, key] of directoryKeys) {
    if (key) {
      pathToPageKey.set(directory, key)
    }
  }

  return {
    pages: orderPages([...pages.values()]),
    assets,
    pathToPageKey,
    markdownByPath,
    csvByPath,
  }
}

function orderPages(pages: Array<NotionPage>): Array<NotionPage> {
  const byParent = new Map<string, Array<NotionPage>>()
  const roots: Array<NotionPage> = []
  const known = new Set(pages.map((page) => page.key))

  for (const page of pages) {
    if (page.parentKey && known.has(page.parentKey)) {
      const siblings = byParent.get(page.parentKey) ?? []
      siblings.push(page)
      byParent.set(page.parentKey, siblings)
    } else {
      roots.push(page)
    }
  }

  const ordered: Array<NotionPage> = []
  const queue = [...roots]

  while (queue.length > 0) {
    const page = queue.shift() as NotionPage
    ordered.push(page)
    queue.push(...(byParent.get(page.key) ?? []))
  }

  return ordered
}

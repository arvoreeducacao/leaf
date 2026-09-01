import { nanoid } from 'nanoid'

import type {
  NotionBlock,
  NotionClient,
  NotionDatabaseObject,
  NotionPageObject,
} from '@/lib/notion/api'
import { plainText } from '@/lib/notion/api'
import type { BlockContext, BlockNode } from '@/lib/notion/blocks'
import { blocksToMarkdown } from '@/lib/notion/blocks'
import {
  MAX_ASSET_BYTES,
  MAX_ASSET_LABEL,
  MAX_CRAWL_PAGES,
} from '@/lib/notion/limits'
import { contentTypeOf, isImagePath } from '@/lib/notion/plan'
import type { NotionAsset, NotionPage, NotionPlan } from '@/lib/notion/plan'

export type CrawlMessages = Readonly<{
  untitled: string
  assetFailed: (name: string) => string
  assetTooLarge: (name: string, limit: string) => string
  pageFailed: (title: string) => string
  crawlTruncated: (max: number) => string
}>

export type CrawlEvent =
  | Readonly<{ type: 'page'; title: string; done: number }>
  | Readonly<{ type: 'plan'; plan: NotionPlan; warnings: Array<string> }>

type Pending =
  | Readonly<{ kind: 'page'; id: string; parentKey: string | null }>
  | Readonly<{
      kind: 'database'
      id: string
      parentKey: string | null
    }>

const fallbackContentType = 'application/octet-stream'

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const dot = path.lastIndexOf('.')
    const extension = dot === -1 ? '' : path.slice(dot).toLowerCase()

    return /^\.[a-z0-9]{2,5}$/.test(extension) ? extension : ''
  } catch {
    return ''
  }
}

export function pageTitle(page: NotionPageObject, fallback: string): string {
  const properties = page.properties ?? {}

  for (const value of Object.values(properties)) {
    const property = value as { type?: string; title?: unknown }

    if (property?.type === 'title') {
      const text = plainText(property.title).trim()

      if (text.length > 0) {
        return text.slice(0, 200)
      }
    }
  }

  return fallback
}

export function databaseTitle(
  database: NotionDatabaseObject,
  fallback: string,
): string {
  const text = plainText(database.title).trim()

  return text.length > 0 ? text.slice(0, 200) : fallback
}

function titlePropertyName(database: NotionDatabaseObject): string | null {
  for (const [name, property] of Object.entries(database.properties ?? {})) {
    if (property?.type === 'title') {
      return name
    }
  }

  return null
}

function propertyToCell(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const property = value as Record<string, unknown>

  switch (property.type) {
    case 'title':
    case 'rich_text':
      return plainText(property[property.type as string])

    case 'number':
      return property.number === null || property.number === undefined
        ? ''
        : String(property.number)

    case 'select':
      return ((property.select as { name?: string } | null)?.name ?? '')

    case 'status':
      return ((property.status as { name?: string } | null)?.name ?? '')

    case 'multi_select':
      return Array.isArray(property.multi_select)
        ? (property.multi_select as Array<{ name?: string }>)
            .map((option) => option.name ?? '')
            .filter((name) => name.length > 0)
            .join(', ')
        : ''

    case 'date': {
      const date = property.date as { start?: string; end?: string } | null

      if (!date?.start) {
        return ''
      }

      return date.end ? `${date.start} → ${date.end}` : date.start
    }

    case 'checkbox':
      return property.checkbox ? 'Yes' : 'No'

    case 'url':
      return (property.url as string | null) ?? ''

    case 'email':
      return (property.email as string | null) ?? ''

    case 'phone_number':
      return (property.phone_number as string | null) ?? ''

    case 'people':
      return Array.isArray(property.people)
        ? (property.people as Array<{ name?: string }>)
            .map((person) => person.name ?? '')
            .filter((name) => name.length > 0)
            .join(', ')
        : ''

    case 'created_time':
      return (property.created_time as string | null) ?? ''

    case 'last_edited_time':
      return (property.last_edited_time as string | null) ?? ''

    default:
      return ''
  }
}

function toCsv(rows: Array<Array<string>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(','),
    )
    .join('\n')
}

export async function* crawlNotionPage(
  client: NotionClient,
  rootId: string,
  messages: CrawlMessages,
  signal?: AbortSignal,
): AsyncGenerator<CrawlEvent> {
  const warnings: Array<string> = []
  const pages: Array<NotionPage> = []
  const assets: Array<NotionAsset> = []
  const markdownByPath = new Map<string, string>()
  const csvByPath = new Map<string, string>()
  const pathToPageKey = new Map<string, string>()
  const assetPathByUrl = new Map<string, string>()
  const pendingAssets = new Map<string, string>()
  const queue: Array<Pending> = [
    { id: rootId, kind: 'page', parentKey: null },
  ]
  const seen = new Set<string>()
  const databaseIds = new Set<string>()

  function pathOfPage(id: string) {
    return `${id}.md`
  }

  function pathOfDatabase(id: string) {
    return `${id}.csv`
  }

  const context: BlockContext = {
    assetPath: (url) => {
      const known = assetPathByUrl.get(url)

      if (known) {
        return known
      }

      const path = `assets/${nanoid(12)}${extensionFromUrl(url)}`

      assetPathByUrl.set(url, path)
      pendingAssets.set(path, url)

      return path
    },
    pagePath: (id) =>
      databaseIds.has(id) ? pathOfDatabase(id) : pathOfPage(id),
  }

  async function readTree(blockId: string): Promise<Array<BlockNode>> {
    const nodes: Array<BlockNode> = []

    for await (const block of client.children(blockId)) {
      if (signal?.aborted) {
        return nodes
      }

      const children =
        block.has_children &&
        block.type !== 'child_page' &&
        block.type !== 'child_database'
          ? await readTree(block.id)
          : []

      nodes.push({ block, children })
    }

    return nodes
  }

  function markDatabases(nodes: Array<BlockNode>) {
    for (const node of nodes) {
      if (node.block.type === 'child_database') {
        databaseIds.add(node.block.id)
      }

      markDatabases(node.children)
    }
  }

  function enqueueChildren(nodes: Array<BlockNode>, parentKey: string) {
    for (const node of nodes) {
      if (node.block.type === 'child_page') {
        queue.push({ id: node.block.id, kind: 'page', parentKey })
      }

      if (node.block.type === 'child_database') {
        queue.push({ id: node.block.id, kind: 'database', parentKey })
      }

      enqueueChildren(node.children, parentKey)
    }
  }

  function registerPage(page: NotionPage) {
    pages.push(page)
    pathToPageKey.set(page.key, page.key)
  }

  let done = 0
  let truncated = false

  while (queue.length > 0) {
    if (signal?.aborted) {
      return
    }

    if (pages.length >= MAX_CRAWL_PAGES) {
      truncated = true
      break
    }

    const item = queue.shift() as Pending

    if (seen.has(item.id)) {
      continue
    }

    seen.add(item.id)

    if (item.kind === 'database') {
      try {
        const database = await client.database(item.id)
        const title = databaseTitle(database, messages.untitled)
        const path = pathOfDatabase(item.id)
        const titleProperty = titlePropertyName(database)
        const others = Object.keys(database.properties ?? {}).filter(
          (name) => name !== titleProperty,
        )
        const names = titleProperty ? [titleProperty, ...others] : others
        const rows: Array<Array<string>> = [names]

        for await (const row of client.rows(item.id)) {
          rows.push(
            names.map((name) => propertyToCell(row.properties?.[name])),
          )
        }

        csvByPath.set(path, toCsv(rows))
        registerPage({
          key: path,
          kind: 'csv',
          parentKey: item.parentKey,
          sourcePath: path,
          title,
        })

        done += 1
        yield { done, title, type: 'page' }
      } catch {
        warnings.push(messages.pageFailed(item.id))
      }

      continue
    }

    try {
      const page = await client.page(item.id)
      const title = pageTitle(page, messages.untitled)
      const path = pathOfPage(item.id)

      registerPage({
        key: path,
        kind: 'markdown',
        parentKey: item.parentKey,
        sourcePath: path,
        title,
      })

      const tree = await readTree(item.id)
      markDatabases(tree)

      const { markdown } = blocksToMarkdown(tree, context)

      markdownByPath.set(path, markdown)
      enqueueChildren(tree, path)

      done += 1
      yield { done, title, type: 'page' }
    } catch {
      warnings.push(messages.pageFailed(item.id))
    }
  }

  if (truncated) {
    warnings.push(messages.crawlTruncated(MAX_CRAWL_PAGES))
  }

  for (const [path, url] of pendingAssets) {
    if (signal?.aborted) {
      return
    }

    try {
      const { bytes, contentType } = await client.download(url)

      if (bytes.byteLength > MAX_ASSET_BYTES) {
        warnings.push(messages.assetTooLarge(path, MAX_ASSET_LABEL))
        continue
      }

      const known = contentTypeOf(path)

      assets.push({
        bytes,
        contentType: known === fallbackContentType ? contentType : known,
        fileName: path.replace('assets/', ''),
        isImage: isImagePath(path),
        path,
      })
    } catch {
      warnings.push(messages.assetFailed(path))
    }
  }

  yield {
    plan: { assets, csvByPath, markdownByPath, pages, pathToPageKey },
    type: 'plan',
    warnings,
  }
}

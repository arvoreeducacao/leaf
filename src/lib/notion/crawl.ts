import { nanoid } from 'nanoid'

import type {
  NotionBlock,
  NotionClient,
  NotionDatabaseObject,
  NotionIcon,
  NotionPageObject,
  NotionUserObject,
} from '@/lib/notion/api'
import { plainText } from '@/lib/notion/api'
import type {
  BlockNode,
  ConvertContext,
  ImportedBlock,
} from '@/lib/notion/convert'
import { convertNodes } from '@/lib/notion/convert'
import {
  MAX_ASSET_BYTES,
  MAX_ASSET_LABEL,
  MAX_CRAWL_PAGES,
} from '@/lib/notion/limits'
import { contentTypeOf, isImagePath } from '@/lib/notion/plan'
import type {
  NotionAsset,
  NotionDatabaseSchema,
  NotionPage,
  NotionPageMeta,
  NotionPlan,
} from '@/lib/notion/plan'
import type {
  ImportedProperty,
  ImportedValue,
  PropertyResolver,
} from '@/lib/notion/properties'
import { importedValue, mapDatabaseProperties } from '@/lib/notion/properties'

export type CrawlMessages = Readonly<{
  untitled: string
  assetFailed: (name: string) => string
  assetTooLarge: (name: string, limit: string) => string
  pageFailed: (title: string) => string
  crawlTruncated: (max: number) => string
  commentsUnavailable: string
  unsupportedBlocks: (count: number, types: string) => string
}>

export type ImportedComment = Readonly<{
  discussionId: string
  body: string
  authorEmail: string | null
  authorName: string | null
  createdAt: Date | null
}>

export type CrawlOptions = Readonly<{ comments?: boolean }>

export type CrawlEvent =
  | Readonly<{ type: 'page'; title: string; done: number }>
  | Readonly<{
      type: 'plan'
      plan: NotionPlan
      warnings: Array<string>
      comments: Map<string, Array<ImportedComment>>
    }>

type Pending =
  | Readonly<{ kind: 'page'; id: string; parentKey: string | null }>
  | Readonly<{ kind: 'database'; id: string; parentKey: string | null }>
  | Readonly<{
      kind: 'row'
      page: NotionPageObject
      parentKey: string
      properties: Array<ImportedProperty>
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

function iconOf(icon: NotionIcon | null | undefined): string | null {
  if (!icon) {
    return null
  }

  if (typeof icon.emoji === 'string' && icon.emoji.length > 0) {
    return icon.emoji.slice(0, 64)
  }

  const url = icon.external?.url ?? icon.file?.url ?? null

  return typeof url === 'string' && url.startsWith('https://')
    ? url.slice(0, 1024)
    : null
}

function stamp(value: string | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function metaOf(source: {
  icon?: NotionIcon | null
  created_time?: string
  last_edited_time?: string
}): NotionPageMeta {
  return {
    createdAt: stamp(source.created_time),
    icon: iconOf(source.icon),
    updatedAt: stamp(source.last_edited_time),
  }
}

export async function* crawlNotionPage(
  client: NotionClient,
  rootId: string,
  messages: CrawlMessages,
  signal?: AbortSignal,
  options: CrawlOptions = {},
): AsyncGenerator<CrawlEvent> {
  yield* crawlNotion(
    client,
    [{ id: rootId, kind: 'page', parentKey: null }],
    messages,
    signal,
    options,
  )
}

export async function* crawlNotionWorkspace(
  client: NotionClient,
  messages: CrawlMessages,
  signal?: AbortSignal,
  options: CrawlOptions = {},
): AsyncGenerator<CrawlEvent> {
  const found = new Map<
    string,
    { object: string; parentId: string | null }
  >()

  for await (const result of client.search()) {
    if (signal?.aborted) {
      return
    }

    const parent = (result.parent ?? {}) as {
      type?: string
      page_id?: string
      database_id?: string
      block_id?: string
    }
    const parentId =
      parent.page_id ?? parent.database_id ?? parent.block_id ?? null

    found.set(result.id, { object: result.object ?? 'page', parentId })
  }

  const seeds: Array<Pending> = []

  for (const [id, entry] of found) {
    const parentKnown =
      entry.parentId !== null && found.has(entry.parentId)

    if (parentKnown) {
      continue
    }

    seeds.push(
      entry.object === 'database'
        ? { id, kind: 'database', parentKey: null }
        : { id, kind: 'page', parentKey: null },
    )
  }

  yield* crawlNotion(client, seeds, messages, signal, options)
}

async function* crawlNotion(
  client: NotionClient,
  seeds: Array<Pending>,
  messages: CrawlMessages,
  signal?: AbortSignal,
  options: CrawlOptions = {},
): AsyncGenerator<CrawlEvent> {
  const warnings: Array<string> = []
  const pages: Array<NotionPage> = []
  const assets: Array<NotionAsset> = []
  const markdownByPath = new Map<string, string>()
  const csvByPath = new Map<string, string>()
  const blocksByPath = new Map<string, Array<ImportedBlock>>()
  const databasesByKey = new Map<string, NotionDatabaseSchema>()
  const rowValuesByKey = new Map<string, Array<ImportedValue>>()
  const metaByKey = new Map<string, NotionPageMeta>()
  const assetSourceByPath = new Map<string, string>()
  const pathToPageKey = new Map<string, string>()
  const assetPathByUrl = new Map<string, string>()
  const pendingAssets = new Map<string, string>()
  const queue: Array<Pending> = [...seeds]
  const seen = new Set<string>()
  const databaseIds = new Set<string>()
  const titleById = new Map<string, string>()
  const commentsByPage = new Map<string, Array<ImportedComment>>()
  const authors = new Map<string, NotionUserObject | null>()
  const unsupportedCounts = new Map<string, number>()

  function pathOfPage(id: string) {
    return `${id}.md`
  }

  function pathOfDatabase(id: string) {
    return `${id}.csv`
  }

  function registerAsset(url: string, _name: string): string | null {
    const known = assetPathByUrl.get(url)

    if (known) {
      return known
    }

    const path = `assets/${nanoid(12)}${extensionFromUrl(url)}`

    assetPathByUrl.set(url, path)
    assetSourceByPath.set(path, url)
    pendingAssets.set(path, url)

    return path
  }

  const context: ConvertContext = {
    assetPath: registerAsset,
    pageRef: (id) =>
      databaseIds.has(id) ? pathOfDatabase(id) : pathOfPage(id),
    unsupported: (type) => {
      unsupportedCounts.set(type, (unsupportedCounts.get(type) ?? 0) + 1)
    },
  }

  async function authorOf(id: string | undefined) {
    if (!id) {
      return null
    }

    if (!authors.has(id)) {
      try {
        authors.set(id, await client.user(id))
      } catch {
        authors.set(id, null)
      }
    }

    return authors.get(id) ?? null
  }

  const resolver: PropertyResolver = {
    personLabel: async (id) => {
      const author = await authorOf(id)

      return author?.person?.email ?? author?.name ?? null
    },
    registerAsset,
  }

  async function readTree(blockId: string): Promise<Array<BlockNode>> {
    const nodes: Array<BlockNode> = []

    for await (const block of client.children(blockId)) {
      if (signal?.aborted) {
        return nodes
      }

      nodes.push({ block, children: await readChildren(block) })
    }

    return nodes
  }

  async function readChildren(block: NotionBlock): Promise<Array<BlockNode>> {
    if (block.type === 'child_page' || block.type === 'child_database') {
      return []
    }

    if (block.type === 'synced_block') {
      const synced = block.synced_block as
        | { synced_from?: { block_id?: string } | null }
        | undefined
      const original = synced?.synced_from?.block_id

      if (original) {
        try {
          return await readTree(original)
        } catch {
          return []
        }
      }
    }

    return block.has_children ? readTree(block.id) : []
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

  async function readComments(pageId: string, pageKey: string) {
    const threads: Array<ImportedComment> = []

    try {
      for await (const comment of client.comments(pageId)) {
        const body = plainText(comment.rich_text).trim()

        if (body.length === 0) {
          continue
        }

        const author = await authorOf(comment.created_by?.id)

        threads.push({
          authorEmail: author?.person?.email ?? null,
          authorName: author?.name ?? null,
          body,
          createdAt: comment.created_time
            ? new Date(comment.created_time)
            : null,
          discussionId: comment.discussion_id ?? comment.id,
        })
      }
    } catch {
      warnings.push(messages.commentsUnavailable)

      return
    }

    if (threads.length > 0) {
      commentsByPage.set(pageKey, threads)
    }
  }

  async function downloadPending() {
    for (const [path, url] of pendingAssets) {
      if (signal?.aborted) {
        return
      }

      pendingAssets.delete(path)

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
  }

  async function readPageBody(id: string, path: string) {
    const tree = await readTree(id)

    markDatabases(tree)
    blocksByPath.set(path, convertNodes(tree, context))
    enqueueChildren(tree, path)
    await downloadPending()
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

    if (item.kind === 'row') {
      if (seen.has(item.page.id)) {
        continue
      }

      seen.add(item.page.id)

      const title = pageTitle(item.page, messages.untitled)
      const path = pathOfPage(item.page.id)

      titleById.set(item.page.id, title)
      metaByKey.set(path, metaOf(item.page))
      pages.push({
        key: path,
        kind: 'blocks',
        parentKey: item.parentKey,
        sourcePath: path,
        title,
      })
      pathToPageKey.set(path, path)

      const values: Array<ImportedValue> = []

      for (const property of item.properties) {
        values.push(
          await importedValue(
            property,
            item.page.properties?.[property.notionName],
            resolver,
          ),
        )
      }

      rowValuesByKey.set(path, values)

      try {
        if (options.comments) {
          await readComments(item.page.id, path)
        }

        await readPageBody(item.page.id, path)
      } catch {
        warnings.push(messages.pageFailed(title))
      }

      done += 1
      yield { done, title, type: 'page' }

      continue
    }

    if (seen.has(item.id)) {
      continue
    }

    seen.add(item.id)

    if (item.kind === 'database') {
      try {
        const database = await client.database(item.id)
        const title = databaseTitle(database, messages.untitled)
        const path = pathOfDatabase(item.id)
        const properties = mapDatabaseProperties(database.properties ?? {})

        databaseIds.add(item.id)
        titleById.set(item.id, title)
        metaByKey.set(path, metaOf(database))
        databasesByKey.set(path, { properties })
        pages.push({
          key: path,
          kind: 'csv',
          parentKey: item.parentKey,
          sourcePath: path,
          title,
        })
        pathToPageKey.set(path, path)

        for await (const row of client.rows(item.id)) {
          if (signal?.aborted) {
            return
          }

          queue.push({ kind: 'row', page: row, parentKey: path, properties })
        }

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

      titleById.set(item.id, title)
      metaByKey.set(path, metaOf(page))
      pages.push({
        key: path,
        kind: 'blocks',
        parentKey: item.parentKey,
        sourcePath: path,
        title,
      })
      pathToPageKey.set(path, path)

      if (options.comments) {
        await readComments(item.id, path)
      }

      await readPageBody(item.id, path)

      done += 1
      yield { done, title, type: 'page' }
    } catch {
      warnings.push(messages.pageFailed(item.id))
    }
  }

  if (truncated) {
    warnings.push(messages.crawlTruncated(MAX_CRAWL_PAGES))
  }

  for (const values of rowValuesByKey.values()) {
    for (const [index, value] of values.entries()) {
      if (value && typeof value === 'object' && 'relation' in value) {
        const titles = value.relation
          .map((id) => titleById.get(id))
          .filter((title): title is string => Boolean(title))

        values[index] = titles.join(', ')
      }
    }
  }

  if (unsupportedCounts.size > 0) {
    const total = [...unsupportedCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    )

    warnings.push(
      messages.unsupportedBlocks(total, [...unsupportedCounts.keys()].join(', ')),
    )
  }

  yield {
    comments: commentsByPage,
    plan: {
      assetSourceByPath,
      assets,
      blocksByPath,
      csvByPath,
      databasesByKey,
      markdownByPath,
      metaByKey,
      pages,
      pathToPageKey,
      rowValuesByKey,
    },
    type: 'plan',
    warnings,
  }
}

import { and, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { databaseProperties, databaseViews, documents } from '@/db/schema'
import type { OrgAccess } from '@/db/schema'
import { inferDatabase } from '@/lib/database/csv-import'
import {
  MAX_PROPERTY_NAME,
  type PropertyValue,
  serializeOptions,
  serializeValues,
} from '@/lib/database/values'
import { serializeViewConfig } from '@/lib/database/views'
import { MAX_DATABASE_ROWS } from '@/lib/databases'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { parseCsv } from '@/lib/notion/csv'
import { MAX_ASSET_BYTES, MAX_ASSET_LABEL } from '@/lib/notion/limits'
import type { NotionImportMessages } from '@/lib/notion/messages'
import {
  convertAsides,
  convertToggles,
  promoteCallouts,
  rewriteLinks,
  stripLeadingTitle,
} from '@/lib/notion/markdown'
import type { NotionLinkTarget } from '@/lib/notion/markdown'
import { baseNameOf, extensionOf } from '@/lib/notion/paths'
import { buildImportPlan, isImagePath } from '@/lib/notion/plan'
import type { NotionPage, NotionPlan } from '@/lib/notion/plan'
import { NotionImportError, readZipEntries } from '@/lib/notion/zip'
import { storage } from '@/lib/storage'

const maxWarnings = 40

const insertChunkSize = 100

export type ImportSummary = Readonly<{
  pages: number
  assets: number
  warnings: Array<string>
  rootId: string | null
  rootTitle: string | null
}>

export type ImportEvent =
  | Readonly<{
      type: 'progress'
      phase: 'assets' | 'pages'
      done: number
      total: number
      label: string
    }>
  | Readonly<{ type: 'done'; summary: ImportSummary }>
  | Readonly<{ type: 'error'; error: string }>

export type ImportOwner = Readonly<{
  id: string
  orgId?: string | null
  teamspaceId?: string | null
  orgAccess?: OrgAccess | null
  parentId?: string | null
}>

function assetKeyFor(path: string) {
  const extension = extensionOf(path)

  return `u/${nanoid(16)}${extension.length > 0 ? extension : '.bin'}`
}

export async function* importNotionZip(
  data: Uint8Array,
  owner: ImportOwner,
  messages: NotionImportMessages,
  signal?: AbortSignal,
): AsyncGenerator<ImportEvent> {
  const warnings: Array<string> = []

  function warn(message: string) {
    if (warnings.length < maxWarnings) {
      warnings.push(message)
    }
  }

  let plan: NotionPlan

  try {
    plan = buildImportPlan(
      readZipEntries(data, messages),
      messages.untitled,
    )
  } catch (error) {
    yield {
      type: 'error',
      error:
        error instanceof NotionImportError
          ? error.message
          : messages.unreadableZip,
    }

    return
  }

  if (plan.pages.length === 0) {
    yield {
      type: 'error',
      error: messages.noPages,
    }

    return
  }

  const assetUrls = new Map<string, string>()
  let uploaded = 0

  for (const [index, asset] of plan.assets.entries()) {
    if (signal?.aborted) {
      return
    }

    if (asset.bytes.byteLength > MAX_ASSET_BYTES) {
      warn(messages.assetTooLarge(asset.fileName, MAX_ASSET_LABEL))
    } else {
      const key = assetKeyFor(asset.path)

      try {
        await storage.put(key, Buffer.from(asset.bytes), asset.contentType)
        assetUrls.set(asset.path, `/api/uploads/${key}`)
        uploaded += 1
      } catch {
        warn(messages.assetFailed(asset.fileName))
      }
    }

    yield {
      type: 'progress',
      phase: 'assets',
      done: index + 1,
      total: plan.assets.length,
      label: asset.fileName,
    }
  }

  const idByKey = new Map<string, string>()

  for (const page of plan.pages) {
    idByKey.set(page.key, nanoid(12))
  }

  const now = new Date()
  const rows = plan.pages.map((page) => ({
    id: idByKey.get(page.key) as string,
    ownerId: owner.id,
    orgId: owner.orgId ?? null,
    teamspaceId: owner.teamspaceId ?? null,
    orgAccess: owner.orgAccess ?? null,
    parentId: page.parentKey
      ? (idByKey.get(page.parentKey) ?? owner.parentId ?? null)
      : (owner.parentId ?? null),
    title: page.title,
    createdAt: now,
    updatedAt: now,
  }))

  for (let index = 0; index < rows.length; index += insertChunkSize) {
    await db.insert(documents).values(rows.slice(index, index + insertChunkSize))
  }

  function resolveLink(path: string): NotionLinkTarget {
    const pageKey = plan.pathToPageKey.get(path)

    if (pageKey) {
      const id = idByKey.get(pageKey)

      if (id) {
        return { kind: 'document', url: `/doc/${id}` }
      }
    }

    const url = assetUrls.get(path)

    if (url) {
      return isImagePath(path)
        ? { kind: 'image', url }
        : { kind: 'file', url, label: baseNameOf(path) }
    }

    return { kind: 'missing' }
  }

  function sourceMarkdown(page: NotionPage): string {
    if (page.kind === 'markdown' && page.sourcePath) {
      return stripLeadingTitle(
        plan.markdownByPath.get(page.sourcePath) ?? '',
        page.title,
      )
    }

    return ''
  }

  async function materializeDatabase(page: NotionPage): Promise<number> {
    const databaseId = idByKey.get(page.key)

    if (!databaseId || !page.sourcePath) {
      return 0
    }

    const inferred = inferDatabase(
      parseCsv(plan.csvByPath.get(page.sourcePath) ?? ''),
      messages.csvColumn,
    )

    if (!inferred) {
      return 0
    }

    const stamp = new Date()

    await db
      .update(documents)
      .set({ kind: 'database', content: null })
      .where(eq(documents.id, databaseId))

    const propertyIds = inferred.properties.map(() => nanoid(12))

    if (inferred.properties.length > 0) {
      await db.insert(databaseProperties).values(
        inferred.properties.map((property, index) => ({
          id: propertyIds[index],
          databaseId,
          name: property.name.slice(0, MAX_PROPERTY_NAME),
          type: property.type,
          options:
            property.options.length > 0
              ? serializeOptions(property.options)
              : null,
          position: index,
          createdAt: stamp,
        })),
      )
    }

    await db.insert(databaseViews).values({
      id: nanoid(12),
      databaseId,
      name: messages.csvView,
      type: 'table',
      config: serializeViewConfig({
        groupByPropertyId: null,
        filters: [],
        sorts: [],
        hiddenPropertyIds: [],
      }),
      position: 0,
      createdAt: stamp,
    })

    const children = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(
        and(eq(documents.parentId, databaseId), isNull(documents.deletedAt)),
      )

    const idByTitle = new Map<string, string>()

    for (const child of children) {
      const key = child.title.trim().toLowerCase()

      if (key.length > 0 && !idByTitle.has(key)) {
        idByTitle.set(key, child.id)
      }
    }

    const matched = new Set<string>()
    let added = 0

    for (const row of inferred.rows.slice(0, MAX_DATABASE_ROWS)) {
      const values: Record<string, PropertyValue> = {}

      for (const [index, value] of row.values.entries()) {
        if (value !== undefined) {
          values[propertyIds[index]] = value as PropertyValue
        }
      }

      const key = row.title.trim().toLowerCase()
      const existing = key.length > 0 ? idByTitle.get(key) : undefined

      if (existing && !matched.has(existing)) {
        matched.add(existing)

        await db
          .update(documents)
          .set({ kind: 'row', properties: serializeValues(values) })
          .where(eq(documents.id, existing))

        continue
      }

      const rowId = nanoid(12)
      const rowStamp = new Date(stamp.getTime() + added + 1)

      await db.insert(documents).values({
        id: rowId,
        ownerId: owner.id,
        parentId: databaseId,
        orgId: owner.orgId ?? null,
        teamspaceId: owner.teamspaceId ?? null,
        orgAccess: owner.orgAccess ?? null,
        kind: 'row',
        title: row.title.slice(0, 200),
        properties: serializeValues(values),
        createdAt: rowStamp,
        updatedAt: rowStamp,
      })

      added += 1
    }

    for (const child of children) {
      if (!matched.has(child.id)) {
        await db
          .update(documents)
          .set({ kind: 'row' })
          .where(eq(documents.id, child.id))
      }
    }

    return added
  }

  let created = 0
  let toggles = 0
  let missingLinks = 0

  for (const [index, page] of plan.pages.entries()) {
    if (signal?.aborted) {
      return
    }

    const id = idByKey.get(page.key) as string

    try {
      const raw = sourceMarkdown(page)
      const toggled = convertToggles(raw)
      toggles += toggled.toggles

      const linked = rewriteLinks(
        convertAsides(toggled.markdown),
        page.sourcePath ?? '',
        resolveLink,
      )
      missingLinks += linked.missing

      const blocks = promoteCallouts(await markdownToBlocks(linked.markdown))

      await db
        .update(documents)
        .set({ content: JSON.stringify(blocks) })
        .where(eq(documents.id, id))

      created += 1
    } catch {
      warn(messages.pageFailed(page.title))
    }

    yield {
      type: 'progress',
      phase: 'pages',
      done: index + 1,
      total: plan.pages.length,
      label: page.title,
    }
  }

  let databases = 0

  for (const page of plan.pages) {
    if (page.kind !== 'csv' || signal?.aborted) {
      continue
    }

    try {
      created += await materializeDatabase(page)
      databases += 1
    } catch {
      warn(messages.pageFailed(page.title))
    }
  }

  if (databases > 0) {
    warn(messages.csvDatabases(databases))
  }

  if (toggles > 0) {
    warn(messages.togglesDegraded(toggles))
  }

  if (missingLinks > 0) {
    warn(messages.missingLinks(missingLinks))
  }

  const root = plan.pages[0]

  yield {
    type: 'done',
    summary: {
      pages: created,
      assets: uploaded,
      warnings,
      rootId: idByKey.get(root.key) ?? null,
      rootTitle: root.title,
    },
  }
}

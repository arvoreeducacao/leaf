import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import {
  comments,
  databaseProperties,
  databaseViews,
  documents,
  notionDocuments,
  user,
} from '@/db/schema'
import type { DatabasePropertyType } from '@/db/schema'
import type { Person } from '@/lib/database/people'
import { listDatabasePeople } from '@/lib/databases'
import {
  MAX_PROPERTY_NAME,
  type PropertyValue,
  parseOptions,
  serializeOptions,
  serializeValues,
} from '@/lib/database/values'
import type { SelectOption } from '@/lib/database/values'
import { serializeViewConfig } from '@/lib/database/views'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import type {
  NotionBlock,
  NotionClient,
  NotionUserObject,
} from '@/lib/notion/api'
import { plainText } from '@/lib/notion/api'
import type { BlockNode, ImportedBlock } from '@/lib/notion/convert'
import { convertNodes } from '@/lib/notion/convert'
import { databaseTitle, pageTitle } from '@/lib/notion/crawl'
import type { ImportEvent, ImportOwner } from '@/lib/notion/import'
import { MAX_ASSET_BYTES, MAX_ASSET_LABEL, MAX_CRAWL_PAGES } from '@/lib/notion/limits'
import type { NotionImportMessages } from '@/lib/notion/messages'
import { contentTypeOf } from '@/lib/notion/plan'
import type { ImportedProperty, ImportedValue } from '@/lib/notion/properties'
import { importedValue, mapDatabaseProperties } from '@/lib/notion/properties'

const placeholderPrefix = 'notion://'

const maxWarnings = 40

export type SyncOptions = Readonly<{
  comments?: boolean
  force?: boolean
  storeAsset: (
    bytes: Uint8Array,
    contentType: string,
    fileName: string,
  ) => Promise<string>
}>

type Mapping = {
  documentId: string
  kind: 'page' | 'database' | 'row'
  lastEditedAt: Date | null
}

type QueueItem =
  | { kind: 'page'; id: string; parentDocId: string | null; parentNotionId: string | null }
  | { kind: 'database'; id: string; parentDocId: string | null; parentNotionId: string | null }

type DatabaseContext = {
  documentId: string
  properties: Array<ImportedProperty>
  propertyIds: Array<string>
  optionsByIndex: Array<Array<SelectOption>>
}

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, '').toLowerCase()
}

function notionFallbackUrl(id: string): string {
  return `https://www.notion.so/${normalizeNotionId(id)}`
}

function iconOf(
  icon:
    | { emoji?: string; external?: { url?: string }; file?: { url?: string } }
    | null
    | undefined,
): string | null {
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

export async function* syncNotion(
  client: NotionClient,
  roots: Array<{ id: string; kind: 'page' | 'database' }> | 'workspace',
  owner: ImportOwner,
  messages: NotionImportMessages,
  signal?: AbortSignal,
  options?: SyncOptions,
): AsyncGenerator<ImportEvent> {
  const warnings: Array<string> = []
  const unsupportedCounts = new Map<string, number>()
  const unresolvedPeople = new Set<string>()

  function warn(message: string) {
    if (warnings.length < maxWarnings) {
      warnings.push(message)
    }
  }

  const people: ReadonlyArray<Person> = await listDatabasePeople(
    owner.orgId ?? null,
    owner.id,
  )
  const personByLabel = new Map<string, string>()

  for (const person of people) {
    personByLabel.set(person.email.toLowerCase(), person.id)

    if (!personByLabel.has(person.name.toLowerCase())) {
      personByLabel.set(person.name.toLowerCase(), person.id)
    }
  }

  const mappingRows = await db
    .select()
    .from(notionDocuments)
    .where(eq(notionDocuments.userId, owner.id))

  const mappings = new Map<string, Mapping>()
  const childrenByParent = new Map<string, Array<string>>()

  for (const row of mappingRows) {
    mappings.set(normalizeNotionId(row.notionId), {
      documentId: row.documentId,
      kind: row.kind,
      lastEditedAt: row.lastEditedAt,
    })

    if (row.parentNotionId) {
      const key = normalizeNotionId(row.parentNotionId)
      const siblings = childrenByParent.get(key) ?? []
      siblings.push(row.notionId)
      childrenByParent.set(key, siblings)
    }
  }

  async function saveMapping(
    notionId: string,
    documentId: string,
    kind: 'page' | 'database' | 'row',
    parentNotionId: string | null,
    lastEditedAt: Date | null,
  ) {
    const key = normalizeNotionId(notionId)
    const known = mappings.has(key)

    if (known) {
      await db
        .update(notionDocuments)
        .set({ lastEditedAt, parentNotionId, updatedAt: new Date() })
        .where(
          and(
            eq(notionDocuments.userId, owner.id),
            eq(notionDocuments.notionId, key),
          ),
        )
    } else {
      await db.insert(notionDocuments).values({
        userId: owner.id,
        notionId: key,
        documentId,
        parentNotionId,
        kind,
        lastEditedAt,
      })
    }

    mappings.set(key, { documentId, kind, lastEditedAt })
  }

  const authors = new Map<string, NotionUserObject | null>()

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

  const assetUrlBySource = new Map<string, string>()
  const pendingAssets: Array<{ url: string; name: string }> = []

  function sourceKeyOf(url: string): string {
    return url.split('?')[0]
  }

  function registerAsset(url: string, name: string): string | null {
    const key = sourceKeyOf(url)
    const known = assetUrlBySource.get(key)

    if (known) {
      return known
    }

    pendingAssets.push({ name, url })

    return `${placeholderPrefix}asset/${encodeURIComponent(key)}`
  }

  async function flushAssets() {
    while (pendingAssets.length > 0) {
      if (signal?.aborted) {
        return
      }

      const next = pendingAssets.shift() as { url: string; name: string }
      const key = sourceKeyOf(next.url)

      if (assetUrlBySource.has(key)) {
        continue
      }

      try {
        const { bytes, contentType } = await client.download(next.url)

        if (bytes.byteLength > MAX_ASSET_BYTES) {
          warn(messages.assetTooLarge(next.name, MAX_ASSET_LABEL))
          assetUrlBySource.set(key, next.url)
          continue
        }

        const known = contentTypeOf(next.name)
        const stored = await options?.storeAsset(
          bytes,
          known === 'application/octet-stream' ? contentType : known,
          next.name,
        )

        assetUrlBySource.set(key, stored ?? next.url)
        uploaded += stored ? 1 : 0
      } catch {
        warn(messages.assetFailed(next.name))
        assetUrlBySource.set(key, next.url)
      }
    }
  }

  const inlineFlags = new Map<string, boolean>()
  const deadDatabases = new Set<string>()

  async function hydrateInlineFlags(nodes: Array<BlockNode>) {
    for (const node of nodes) {
      if (node.block.type === 'child_database') {
        const key = normalizeNotionId(node.block.id)

        if (!inlineFlags.has(key) && !deadDatabases.has(key)) {
          try {
            const database = await client.database(node.block.id)

            inlineFlags.set(key, database.is_inline === true)
          } catch {
            deadDatabases.add(key)
          }
        }
      }

      await hydrateInlineFlags(node.children)
    }
  }

  const convertContext = {
    assetPath: registerAsset,
    isDeadDatabase: (id: string) => deadDatabases.has(normalizeNotionId(id)),
    isInlineDatabase: (id: string) =>
      inlineFlags.get(normalizeNotionId(id)) ?? true,
    pageRef: (id: string) => `${placeholderPrefix}${normalizeNotionId(id)}`,
    unsupported: (type: string) => {
      unsupportedCounts.set(type, (unsupportedCounts.get(type) ?? 0) + 1)
    },
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

  async function importComments(pageId: string, documentId: string) {
    const emailIds = new Map<string, string>()
    const rootByDiscussion = new Map<string, string>()

    try {
      for await (const comment of client.comments(pageId)) {
        const body = plainText(comment.rich_text).trim()

        if (body.length === 0) {
          continue
        }

        const author = await authorOf(comment.created_by?.id)
        const email = author?.person?.email?.toLowerCase() ?? null
        let authorId: string | null = null

        if (email) {
          if (!emailIds.has(email)) {
            const rows = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, email))

            emailIds.set(email, rows[0]?.id ?? '')
          }

          authorId = emailIds.get(email) || null
        }

        const text = (
          authorId || !author?.name ? body : `${author.name}: ${body}`
        ).slice(0, 2000)
        const id = nanoid(12)
        const when = comment.created_time
          ? new Date(comment.created_time)
          : new Date()
        const discussionId = comment.discussion_id ?? comment.id
        const parentId = rootByDiscussion.get(discussionId) ?? null

        await db.insert(comments).values({
          id,
          documentId,
          parentId,
          blockId: null,
          authorId,
          body: text,
          resolvedAt: null,
          createdAt: when,
          updatedAt: when,
        })

        if (!parentId) {
          rootByDiscussion.set(discussionId, id)
        }
      }
    } catch {
      warn(messages.commentsUnavailable)
    }
  }

  async function upsertDocument(
    notionId: string,
    kind: 'page' | 'database' | 'row',
    title: string,
    icon: string | null,
    createdAt: Date | null,
    updatedAt: Date | null,
    parentDocId: string | null,
  ): Promise<{ documentId: string; created: boolean }> {
    const existing = mappings.get(normalizeNotionId(notionId))

    if (existing) {
      await db
        .update(documents)
        .set({
          icon,
          kind,
          title: title.slice(0, 200),
          updatedAt: updatedAt ?? new Date(),
          ...(parentDocId ? { parentId: parentDocId } : {}),
        })
        .where(eq(documents.id, existing.documentId))

      return { created: false, documentId: existing.documentId }
    }

    const documentId = nanoid(12)
    const now = new Date()

    await db.insert(documents).values({
      id: documentId,
      ownerId: owner.id,
      orgId: owner.orgId ?? null,
      teamspaceId: owner.teamspaceId ?? null,
      orgAccess: owner.orgAccess ?? null,
      parentId: parentDocId ?? owner.parentId ?? null,
      kind,
      title: title.slice(0, 200),
      icon,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? now,
    })

    return { created: true, documentId }
  }

  const databaseContexts = new Map<string, DatabaseContext>()

  async function databaseContextFor(
    notionId: string,
    documentId: string,
    properties: Array<ImportedProperty>,
    created: boolean,
  ): Promise<DatabaseContext> {
    const key = normalizeNotionId(notionId)
    const cached = databaseContexts.get(key)

    if (cached) {
      return cached
    }

    const stampNow = new Date()
    let rows = created
      ? []
      : await db
          .select()
          .from(databaseProperties)
          .where(eq(databaseProperties.databaseId, documentId))

    if (rows.length === 0 && properties.length > 0) {
      const values = properties.map((property, index) => ({
        id: nanoid(12),
        databaseId: documentId,
        name: property.name.slice(0, MAX_PROPERTY_NAME),
        type: property.type,
        options:
          property.options.length > 0
            ? serializeOptions(property.options)
            : null,
        position: index,
        createdAt: stampNow,
      }))

      await db.insert(databaseProperties).values(values)
      rows = values.map((value) => ({
        ...value,
        options: value.options ?? null,
      })) as typeof rows

      const views: Array<{
        config: string
        id: string
        name: string
        position: number
        type: 'table' | 'board'
      }> = [
        {
          config: serializeViewConfig({
            filters: [],
            groupByPropertyId: null,
            hiddenPropertyIds: [],
            sorts: [],
          }),
          id: nanoid(12),
          name: messages.csvView,
          position: 0,
          type: 'table',
        },
      ]
      const statusIndex = properties.findIndex(
        (property) => property.type === 'status',
      )

      if (statusIndex >= 0) {
        views.push({
          config: serializeViewConfig({
            filters: [],
            groupByPropertyId: values[statusIndex].id,
            hiddenPropertyIds: [],
            sorts: [],
          }),
          id: nanoid(12),
          name: messages.boardView,
          position: 1,
          type: 'board',
        })
      }

      await db
        .insert(databaseViews)
        .values(views.map((view) => ({ ...view, databaseId: documentId, createdAt: stampNow })))
    }

    const rowByName = new Map(rows.map((row) => [row.name, row]))
    const propertyIds: Array<string> = []
    const optionsByIndex: Array<Array<SelectOption>> = []

    for (const property of properties) {
      const existing = rowByName.get(property.name.slice(0, MAX_PROPERTY_NAME))

      if (existing) {
        propertyIds.push(existing.id)
        optionsByIndex.push(
          property.options.length > 0
            ? property.options
            : parseOptions(existing.options),
        )
        continue
      }

      const id = nanoid(12)

      await db.insert(databaseProperties).values({
        id,
        databaseId: documentId,
        name: property.name.slice(0, MAX_PROPERTY_NAME),
        type: property.type,
        options:
          property.options.length > 0
            ? serializeOptions(property.options)
            : null,
        position: rows.length + propertyIds.length,
        createdAt: stampNow,
      })
      propertyIds.push(id)
      optionsByIndex.push(property.options)
    }

    const context: DatabaseContext = {
      documentId,
      optionsByIndex,
      properties,
      propertyIds,
    }

    databaseContexts.set(key, context)

    return context
  }

  const pendingRelationValues: Array<{
    documentId: string
    propertyId: string
    ids: ReadonlyArray<string>
    values: Record<string, PropertyValue>
  }> = []

  function toPropertyValue(
    value: ImportedValue,
    type: DatabasePropertyType,
    optionsForProperty: ReadonlyArray<SelectOption>,
  ): PropertyValue | { relation: ReadonlyArray<string> } {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === 'object' && 'relation' in value) {
      return value
    }

    if (type === 'select' || type === 'status') {
      return typeof value === 'string'
        ? (optionsForProperty.find((option) => option.name === value)?.id ??
            null)
        : null
    }

    if (type === 'multiSelect') {
      return Array.isArray(value)
        ? value.flatMap((name) => {
            const option = optionsForProperty.find(
              (candidate) => candidate.name === name,
            )

            return option ? [option.id] : []
          })
        : []
    }

    if (type === 'person') {
      return Array.isArray(value)
        ? value.flatMap((label) => {
            const id = personByLabel.get(label.toLowerCase())

            if (!id) {
              unresolvedPeople.add(label)

              return []
            }

            return [id]
          })
        : []
    }

    return value as PropertyValue
  }

  const assetPlaceholderPattern = new RegExp(
    `${placeholderPrefix}asset/([^\\s"']+)`,
    'g',
  )

  function resolveAssetPlaceholdersInValues(
    values: Record<string, PropertyValue>,
  ) {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' && value.includes(placeholderPrefix)) {
        values[key] = value.replace(assetPlaceholderPattern, (_, encoded) => {
          const sourceKey = decodeURIComponent(encoded)

          return assetUrlBySource.get(sourceKey) ?? sourceKey
        })
      }
    }
  }

  const touchedDocIds = new Set<string>()
  const seen = new Set<string>()
  const queue: Array<QueueItem> = []

  const deferredRoots: Array<QueueItem> = []

  if (roots === 'workspace') {
    const found = new Map<
      string,
      { object: string; parentId: string | null; parentType: string }
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

      found.set(result.id, {
        object: result.object ?? 'page',
        parentId,
        parentType: parent.type ?? 'workspace',
      })
    }

    for (const [id, entry] of found) {
      const item: QueueItem = {
        id,
        kind: entry.object === 'database' ? 'database' : 'page',
        parentDocId: null,
        parentNotionId: null,
      }

      if (entry.parentType === 'workspace' || entry.parentId === null) {
        queue.push(item)
        continue
      }

      deferredRoots.push(item)
    }
  } else {
    for (const root of roots) {
      queue.push({ ...root, parentDocId: null, parentNotionId: null })
    }
  }

  function enqueueChildren(
    nodes: Array<BlockNode>,
    parentDocId: string,
    parentNotionId: string,
  ) {
    for (const node of nodes) {
      if (node.block.type === 'child_page') {
        queue.push({
          id: node.block.id,
          kind: 'page',
          parentDocId,
          parentNotionId,
        })
      }

      if (node.block.type === 'child_database') {
        queue.push({
          id: node.block.id,
          kind: 'database',
          parentDocId,
          parentNotionId,
        })
      }

      enqueueChildren(node.children, parentDocId, parentNotionId)
    }
  }

  function enqueueKnownChildren(notionId: string, parentDocId: string) {
    for (const childId of childrenByParent.get(normalizeNotionId(notionId)) ??
      []) {
      const child = mappings.get(normalizeNotionId(childId))

      if (!child) {
        continue
      }

      queue.push({
        id: childId,
        kind: child.kind === 'database' ? 'database' : 'page',
        parentDocId,
        parentNotionId: notionId,
      })
    }
  }

  let processed = 0
  let written = 0
  let skipped = 0
  let uploaded = 0
  let truncated = false
  let rootDocId: string | null = null
  let rootTitle: string | null = null

  let seedingPhase = 0

  while (true) {
    if (signal?.aborted) {
      return
    }

    if (queue.length === 0) {
      if (seedingPhase === 0 && deferredRoots.length > 0) {
        seedingPhase = 1

        for (const deferred of deferredRoots) {
          if (!seen.has(normalizeNotionId(deferred.id))) {
            queue.push(deferred)
          }
        }

        continue
      }

      break
    }

    if (processed >= MAX_CRAWL_PAGES) {
      truncated = true
      break
    }

    const item = queue.shift() as QueueItem
    const idKey = normalizeNotionId(item.id)

    if (seen.has(idKey)) {
      continue
    }

    seen.add(idKey)
    processed += 1

    try {
      if (item.kind === 'database') {
        const database = await client.database(item.id)
        const title = databaseTitle(database, messages.untitled)
        const icon = iconOf(database.icon)
        const existing = mappings.get(idKey)
        const { documentId, created } = await upsertDocument(
          item.id,
          'database',
          title,
          icon,
          stamp(database.created_time),
          stamp(database.last_edited_time),
          item.parentDocId,
        )

        if (!rootDocId) {
          rootDocId = documentId
          rootTitle = title
        }

        touchedDocIds.add(documentId)
        await saveMapping(
          item.id,
          documentId,
          'database',
          item.parentNotionId,
          stamp(database.last_edited_time),
        )
        written += created ? 1 : 0

        const properties = mapDatabaseProperties(database.properties ?? {})
        const context = await databaseContextFor(
          item.id,
          documentId,
          properties,
          created && !existing,
        )

        for await (const row of client.rows(item.id)) {
          if (signal?.aborted) {
            return
          }

          const rowKey = normalizeNotionId(row.id)

          if (seen.has(rowKey)) {
            continue
          }

          seen.add(rowKey)
          processed += 1

          const rowTitle = pageTitle(row, messages.untitled)
          const rowEdited = stamp(row.last_edited_time)
          const rowMapping = mappings.get(rowKey)
          const unchanged =
            rowMapping?.lastEditedAt &&
            rowEdited &&
            rowMapping.lastEditedAt.getTime() >= rowEdited.getTime()

          if (unchanged) {
            skipped += 1
            enqueueKnownChildren(row.id, rowMapping.documentId)
            continue
          }

          const rowDoc = await upsertDocument(
            row.id,
            'row',
            rowTitle,
            iconOf(row.icon),
            stamp(row.created_time),
            rowEdited,
            documentId,
          )

          touchedDocIds.add(rowDoc.documentId)

          const values: Record<string, PropertyValue> = {}

          for (const [index, property] of context.properties.entries()) {
            const raw = await importedValue(
              property,
              row.properties?.[property.notionName],
              {
                personLabel: async (personId) => {
                  const author = await authorOf(personId)

                  return author?.person?.email ?? author?.name ?? null
                },
                registerAsset,
              },
            )
            const converted = toPropertyValue(
              raw,
              property.type,
              context.optionsByIndex[index],
            )

            if (
              converted &&
              typeof converted === 'object' &&
              'relation' in converted
            ) {
              pendingRelationValues.push({
                documentId: rowDoc.documentId,
                ids: converted.relation,
                propertyId: context.propertyIds[index],
                values,
              })
              continue
            }

            if (converted !== null) {
              values[context.propertyIds[index]] = converted
            }
          }

          const tree = await readTree(row.id)
          await hydrateInlineFlags(tree)
          const blocks = convertNodes(tree, convertContext)
          await flushAssets()
          resolveAssetPlaceholdersInValues(values)

          await db
            .update(documents)
            .set({
              content: JSON.stringify(blocks),
              properties: serializeValues(values),
              kind: 'row',
            })
            .where(eq(documents.id, rowDoc.documentId))

          if (rowDoc.created && options?.comments) {
            await importComments(row.id, rowDoc.documentId)
          }

          await saveMapping(row.id, rowDoc.documentId, 'row', item.id, rowEdited)
          enqueueChildren(tree, rowDoc.documentId, row.id)
          written += 1
          yield {
            done: written + skipped,
            label: rowTitle,
            phase: 'reading',
            total: 0,
            type: 'progress',
          }
        }

        yield {
          done: written + skipped,
          label: title,
          phase: 'reading',
          total: 0,
          type: 'progress',
        }

        continue
      }

      let page

      try {
        page = await client.page(item.id)
      } catch {
        seen.delete(idKey)
        processed -= 1
        queue.unshift({ ...item, kind: 'database' })
        continue
      }

      const title = pageTitle(page, messages.untitled)
      const edited = stamp(page.last_edited_time)
      const mapping = mappings.get(idKey)
      const unchanged =
        mapping?.lastEditedAt &&
        edited &&
        mapping.lastEditedAt.getTime() >= edited.getTime()

      if (unchanged) {
        skipped += 1

        if (!rootDocId) {
          rootDocId = mapping.documentId
          rootTitle = title
        }

        if (options?.force) {
          if (item.parentDocId) {
            await db
              .update(documents)
              .set({ parentId: item.parentDocId })
              .where(eq(documents.id, mapping.documentId))
          }

          await saveMapping(
            item.id,
            mapping.documentId,
            mapping.kind,
            item.parentNotionId,
            mapping.lastEditedAt,
          )

          const tree = await readTree(item.id)

          enqueueChildren(tree, mapping.documentId, item.id)
        } else {
          enqueueKnownChildren(item.id, mapping.documentId)
        }

        continue
      }

      const { documentId, created } = await upsertDocument(
        item.id,
        mapping?.kind === 'row' ? 'row' : 'page',
        title,
        iconOf(page.icon),
        stamp(page.created_time),
        edited,
        item.parentDocId,
      )

      if (!rootDocId) {
        rootDocId = documentId
        rootTitle = title
      }

      touchedDocIds.add(documentId)

      const tree = await readTree(item.id)
      await hydrateInlineFlags(tree)
      const blocks = convertNodes(tree, convertContext)
      await flushAssets()

      await db
        .update(documents)
        .set({ content: JSON.stringify(blocks) })
        .where(eq(documents.id, documentId))

      if (created && options?.comments) {
        await importComments(item.id, documentId)
      }

      await saveMapping(item.id, documentId, 'page', item.parentNotionId, edited)
      enqueueChildren(tree, documentId, item.id)
      written += 1
      yield {
        done: written + skipped,
        label: title,
        phase: 'reading',
        total: 0,
        type: 'progress',
      }
    } catch {
      warn(messages.pageFailed(item.id))
    }
  }

  for (const pending of pendingRelationValues) {
    const titles: Array<string> = []
    const missingIds: Array<string> = []

    for (const relatedId of pending.ids) {
      const related = mappings.get(normalizeNotionId(relatedId))

      if (related) {
        missingIds.push(related.documentId)
      }
    }

    if (missingIds.length > 0) {
      const rows = await db
        .select({ id: documents.id, title: documents.title })
        .from(documents)
        .where(inArray(documents.id, missingIds))

      for (const row of rows) {
        titles.push(row.title)
      }
    }

    if (titles.length > 0) {
      pending.values[pending.propertyId] = titles.join(', ').slice(0, 2000)
    }

    await db
      .update(documents)
      .set({ properties: serializeValues(pending.values) })
      .where(eq(documents.id, pending.documentId))
  }

  let missingLinks = 0
  const titleByDocumentId = new Map<string, string>()
  const allDocIds = [...mappings.values()].map((mapping) => mapping.documentId)

  for (let index = 0; index < allDocIds.length; index += 200) {
    const rows = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(inArray(documents.id, allDocIds.slice(index, index + 200)))

    for (const row of rows) {
      titleByDocumentId.set(row.id, row.title)
    }
  }

  function resolvePlaceholders(blocks: Array<ImportedBlock>): Array<ImportedBlock> {
    function resolveRef(value: string): { url: string; title: string | null } {
      const id = value.slice(placeholderPrefix.length)

      if (id.startsWith('asset/')) {
        const key = decodeURIComponent(id.slice('asset/'.length))
        const url = assetUrlBySource.get(key)

        if (!url) {
          missingLinks += 1
        }

        return { title: null, url: url ?? key }
      }

      const mapping = mappings.get(id)

      if (!mapping) {
        missingLinks += 1

        return { title: null, url: notionFallbackUrl(id) }
      }

      return {
        title: titleByDocumentId.get(mapping.documentId) ?? null,
        url: `/doc/${mapping.documentId}`,
      }
    }

    function walkInline(itemValue: unknown): unknown {
      if (Array.isArray(itemValue)) {
        return itemValue.map(walkInline)
      }

      if (!itemValue || typeof itemValue !== 'object') {
        return itemValue
      }

      const inline = itemValue as Record<string, unknown>

      if (
        inline.type === 'link' &&
        typeof inline.href === 'string' &&
        inline.href.startsWith(placeholderPrefix)
      ) {
        const target = resolveRef(inline.href)
        const content = Array.isArray(inline.content)
          ? inline.content.map((piece) => {
              const textItem = piece as Record<string, unknown>

              if (
                textItem?.type === 'text' &&
                typeof textItem.text === 'string' &&
                textItem.text.startsWith(placeholderPrefix)
              ) {
                return {
                  ...textItem,
                  text: target.title ?? notionFallbackUrl(textItem.text.slice(placeholderPrefix.length)),
                }
              }

              return textItem
            })
          : inline.content

        return { ...inline, content, href: target.url }
      }

      return inline
    }

    function walkBlock(block: ImportedBlock): ImportedBlock {
      const next: ImportedBlock = { ...block }

      if (next.props) {
        const props = { ...next.props }

        for (const key of ['url', 'databaseId'] as const) {
          const value = props[key]

          if (
            typeof value === 'string' &&
            value.startsWith(placeholderPrefix)
          ) {
            if (key === 'databaseId') {
              const mapping = mappings.get(
                value.slice(placeholderPrefix.length),
              )

              props[key] = mapping?.documentId ?? ''

              if (!mapping) {
                missingLinks += 1
              }
            } else {
              props[key] = resolveRef(value).url
            }
          }
        }

        next.props = props
      }

      if (Array.isArray(next.content)) {
        next.content = next.content.map(walkInline)
      } else if (
        next.content &&
        typeof next.content === 'object' &&
        (next.content as { type?: string }).type === 'tableContent'
      ) {
        const table = next.content as { rows?: Array<{ cells?: unknown }> }

        next.content = {
          ...table,
          rows: (table.rows ?? []).map((row) => ({
            ...row,
            cells: Array.isArray(row.cells)
              ? row.cells.map(walkInline)
              : row.cells,
          })),
        }
      }

      if (next.children) {
        next.children = next.children.map(walkBlock)
      }

      return next
    }

    return blocks.map(walkBlock)
  }

  const touched = [...touchedDocIds]

  for (let index = 0; index < touched.length; index += 50) {
    const slice = touched.slice(index, index + 50)
    const rows = await db
      .select({ content: documents.content, id: documents.id })
      .from(documents)
      .where(inArray(documents.id, slice))

    for (const row of rows) {
      try {
        const blocks = JSON.parse(row.content ?? '[]') as Array<ImportedBlock>

        await db
          .update(documents)
          .set({
            content: JSON.stringify(
              sanitizeBlocks(resolvePlaceholders(blocks)),
            ),
          })
          .where(eq(documents.id, row.id))
      } catch {
        warn(messages.pageFailed(row.id))
      }
    }
  }

  if (truncated) {
    warn(messages.crawlTruncated(MAX_CRAWL_PAGES))
  }

  if (skipped > 0) {
    warn(messages.skippedUnchanged(skipped))
  }

  if (unsupportedCounts.size > 0) {
    const total = [...unsupportedCounts.values()].reduce(
      (sum, count) => sum + count,
      0,
    )

    warn(
      messages.unsupportedBlocks(
        total,
        [...unsupportedCounts.keys()].join(', '),
      ),
    )
  }

  if (unresolvedPeople.size > 0) {
    warn(
      messages.unresolvedPeople(
        unresolvedPeople.size,
        [...unresolvedPeople].slice(0, 5).join(', '),
      ),
    )
  }

  if (missingLinks > 0) {
    warn(messages.missingLinks(missingLinks))
  }

  yield {
    summary: {
      assets: uploaded,
      pages: written,
      rootId: rootDocId,
      rootTitle,
      warnings,
    },
    type: 'done',
  }
}

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import {
  comments,
  databaseProperties,
  databaseViews,
  documents,
  user,
} from '@/db/schema'
import type { OrgAccess } from '@/db/schema'
import { inferDatabase } from '@/lib/database/csv-import'
import type { Person } from '@/lib/database/people'
import { listDatabasePeople } from '@/lib/databases'
import {
  MAX_PROPERTY_NAME,
  type PropertyValue,
  serializeOptions,
  serializeValues,
} from '@/lib/database/values'
import type { SelectOption } from '@/lib/database/values'
import { emptyViewConfig, serializeViewConfig } from '@/lib/database/views'
import { MAX_DATABASE_ROWS } from '@/lib/databases'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import { parseCsv } from '@/lib/notion/csv'
import type { ImportedBlock } from '@/lib/notion/convert'
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
import type { ImportedComment } from '@/lib/notion/crawl'
import type { ImportedValue } from '@/lib/notion/properties'
import { createRowMatcher } from '@/lib/notion/row-match'
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
      phase: 'assets' | 'pages' | 'reading'
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

export function assetKeyFor(path: string) {
  const extension = extensionOf(path)

  return `u/${nanoid(16)}${extension.length > 0 ? extension : '.bin'}`
}

export async function* importNotionZip(
  data: Uint8Array,
  owner: ImportOwner,
  messages: NotionImportMessages,
  signal?: AbortSignal,
): AsyncGenerator<ImportEvent> {
  let plan: NotionPlan

  try {
    plan = buildImportPlan(readZipEntries(data, messages), messages.untitled)
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

  yield* importNotionPlan(plan, owner, messages, signal)
}

const maxCommentBody = 2000

async function importComments(
  threadsByPageKey: ReadonlyMap<string, ReadonlyArray<ImportedComment>>,
  idByKey: ReadonlyMap<string, string>,
) {
  const emails = new Set<string>()

  for (const threads of threadsByPageKey.values()) {
    for (const thread of threads) {
      if (thread.authorEmail) {
        emails.add(thread.authorEmail.toLowerCase())
      }
    }
  }

  const people = new Map<string, string>()

  if (emails.size > 0) {
    const rows = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(inArray(user.email, [...emails]))

    for (const row of rows) {
      people.set(row.email.toLowerCase(), row.id)
    }
  }

  let created = 0

  for (const [pageKey, threads] of threadsByPageKey) {
    const documentId = idByKey.get(pageKey)

    if (!documentId) {
      continue
    }

    const rootByDiscussion = new Map<string, string>()

    for (const thread of threads) {
      const authorId = thread.authorEmail
        ? (people.get(thread.authorEmail.toLowerCase()) ?? null)
        : null
      const body = (
        authorId || !thread.authorName
          ? thread.body
          : `${thread.authorName}: ${thread.body}`
      ).slice(0, maxCommentBody)
      const id = nanoid(12)
      const stamp = thread.createdAt ?? new Date()
      const parentId = rootByDiscussion.get(thread.discussionId) ?? null

      await db.insert(comments).values({
        id,
        documentId,
        parentId,
        blockId: null,
        authorId,
        body,
        resolvedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      })

      if (!parentId) {
        rootByDiscussion.set(thread.discussionId, id)
      }

      created += 1
    }
  }

  return created
}

type LinkTarget =
  | Readonly<{ kind: 'document'; id: string; title: string }>
  | Readonly<{ kind: 'asset'; url: string }>
  | Readonly<{ kind: 'missing'; fallback: string | null }>

type RewriteOutcome = Readonly<{
  blocks: Array<ImportedBlock>
  missing: number
}>

export function rewriteImportedBlocks(
  blocks: Array<ImportedBlock>,
  resolve: (path: string) => LinkTarget | null,
): RewriteOutcome {
  let missing = 0

  function resolveUrl(value: string): string {
    const target = resolve(value)

    if (!target) {
      return value
    }

    if (target.kind === 'document') {
      return `/doc/${target.id}`
    }

    if (target.kind === 'asset') {
      return target.url
    }

    missing += 1

    return target.fallback ?? value
  }

  function walkInline(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map(walkInline)
    }

    if (!item || typeof item !== 'object') {
      return item
    }

    const inline = item as Record<string, unknown>

    if (inline.type !== 'link' || typeof inline.href !== 'string') {
      return inline
    }

    const target = resolve(inline.href)

    if (!target) {
      return inline
    }

    if (target.kind === 'missing') {
      missing += 1

      return target.fallback
        ? { ...inline, href: target.fallback }
        : { ...inline, href: '' }
    }

    const href =
      target.kind === 'document' ? `/doc/${target.id}` : target.url
    const content = Array.isArray(inline.content)
      ? inline.content.map((piece) => {
          const textItem = piece as Record<string, unknown>

          return target.kind === 'document' &&
            textItem?.type === 'text' &&
            textItem.text === inline.href
            ? { ...textItem, text: target.title }
            : textItem
        })
      : inline.content

    return { ...inline, content, href }
  }

  function walkContent(content: unknown): unknown {
    if (Array.isArray(content)) {
      return content.map(walkInline)
    }

    if (!content || typeof content !== 'object') {
      return content
    }

    const table = content as Record<string, unknown>

    if (table.type === 'tableContent' && Array.isArray(table.rows)) {
      return {
        ...table,
        rows: table.rows.map((row) => {
          const cells = (row as { cells?: unknown }).cells

          return {
            ...(row as Record<string, unknown>),
            cells: Array.isArray(cells) ? cells.map(walkInline) : cells,
          }
        }),
      }
    }

    return content
  }

  function walkBlock(block: ImportedBlock): ImportedBlock {
    const next: ImportedBlock = { ...block }

    if (next.props) {
      const props = { ...next.props }

      if (typeof props.url === 'string') {
        props.url = resolveUrl(props.url)
      }

      if (next.type === 'database' && typeof props.databaseId === 'string') {
        const target = resolve(props.databaseId)

        if (target?.kind === 'document') {
          props.databaseId = target.id
        } else {
          missing += 1
          props.databaseId = ''
        }
      }

      next.props = props
    }

    if (next.content !== undefined) {
      next.content = walkContent(next.content)
    }

    if (next.children) {
      next.children = next.children.map(walkBlock)
    }

    return next
  }

  return { blocks: blocks.map(walkBlock), missing }
}

export async function* importNotionPlan(
  plan: NotionPlan,
  owner: ImportOwner,
  messages: NotionImportMessages,
  signal?: AbortSignal,
  threadsByPageKey?: ReadonlyMap<string, ReadonlyArray<ImportedComment>>,
): AsyncGenerator<ImportEvent> {
  const warnings: Array<string> = []
  const unresolvedPeople = new Set<string>()
  const people: ReadonlyArray<Person> = await listDatabasePeople(
    owner.orgId ?? null,
    owner.id,
  )
  const personByEmail = new Map<string, string>()
  const personByName = new Map<string, string>()

  for (const person of people) {
    personByEmail.set(person.email.toLowerCase(), person.id)

    if (!personByName.has(person.name.toLowerCase())) {
      personByName.set(person.name.toLowerCase(), person.id)
    }
  }

  function warn(message: string) {
    if (warnings.length < maxWarnings) {
      warnings.push(message)
    }
  }

  if (plan.pages.length === 0) {
    yield {
      type: 'error',
      error: messages.noPages,
    }

    return
  }

  const assetUrls = new Map<string, string>(plan.assetUrlByPath ?? [])
  let uploaded = assetUrls.size

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
  const titleByKey = new Map<string, string>()

  for (const page of plan.pages) {
    idByKey.set(page.key, nanoid(12))
    titleByKey.set(page.key, page.title)
  }

  const now = new Date()
  const rows = plan.pages.map((page) => {
    const meta = plan.metaByKey?.get(page.key)

    return {
      id: idByKey.get(page.key) as string,
      ownerId: owner.id,
      orgId: owner.orgId ?? null,
      teamspaceId: owner.teamspaceId ?? null,
      orgAccess: owner.orgAccess ?? null,
      parentId: page.parentKey
        ? (idByKey.get(page.parentKey) ?? owner.parentId ?? null)
        : (owner.parentId ?? null),
      title: page.title,
      icon: meta?.icon ?? null,
      createdAt: meta?.createdAt ?? now,
      updatedAt: meta?.updatedAt ?? now,
    }
  })

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

  function resolveNative(path: string): LinkTarget | null {
    const pageKey = plan.pathToPageKey.get(path)

    if (pageKey) {
      const id = idByKey.get(pageKey)

      if (id) {
        return {
          id,
          kind: 'document',
          title: titleByKey.get(pageKey) ?? path,
        }
      }
    }

    const url = assetUrls.get(path)

    if (url) {
      return { kind: 'asset', url }
    }

    if (path.startsWith('assets/') || plan.assetSourceByPath?.has(path)) {
      return {
        fallback: plan.assetSourceByPath?.get(path) ?? null,
        kind: 'missing',
      }
    }

    if (/^[0-9a-f-]{32,36}\.(md|csv)$/i.test(path)) {
      return { fallback: null, kind: 'missing' }
    }

    return null
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

  function toPropertyValue(
    value: ImportedValue,
    type: string,
    options: ReadonlyArray<SelectOption>,
  ): PropertyValue {
    if (value === null || value === undefined) {
      return null
    }

    if (value && typeof value === 'object' && 'relation' in value) {
      return null
    }

    if (type === 'select' || type === 'status') {
      if (typeof value !== 'string') {
        return null
      }

      return (
        options.find((option) => option.name === value)?.id ?? null
      )
    }

    if (type === 'multiSelect') {
      if (!Array.isArray(value)) {
        return []
      }

      return value.flatMap((name) => {
        const option = options.find((candidate) => candidate.name === name)

        return option ? [option.id] : []
      })
    }

    if (type === 'person') {
      if (!Array.isArray(value)) {
        return []
      }

      return value.flatMap((label) => {
        const key = label.toLowerCase()
        const id = personByEmail.get(key) ?? personByName.get(key)

        if (!id) {
          unresolvedPeople.add(label)

          return []
        }

        return [id]
      })
    }

    return value as PropertyValue
  }

  async function materializeNativeDatabase(page: NotionPage): Promise<void> {
    const databaseId = idByKey.get(page.key)
    const schema = plan.databasesByKey?.get(page.key)

    if (!databaseId || !schema) {
      return
    }

    const stamp = new Date()

    await db
      .update(documents)
      .set({ kind: 'database', content: null })
      .where(eq(documents.id, databaseId))

    const propertyIds = schema.properties.map(() => nanoid(12))

    if (schema.properties.length > 0) {
      await db.insert(databaseProperties).values(
        schema.properties.map((property, index) => ({
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

    const views: Array<{
      config: string
      id: string
      name: string
      position: number
      type: 'table' | 'board'
    }> = [
      {
        config: serializeViewConfig({
          ...emptyViewConfig,
        }),
        id: nanoid(12),
        name: messages.csvView,
        position: 0,
        type: 'table',
      },
    ]

    const statusIndex = schema.properties.findIndex(
      (property) => property.type === 'status',
    )

    if (statusIndex >= 0) {
      views.push({
        config: serializeViewConfig({
          ...emptyViewConfig,
          groupByPropertyId: propertyIds[statusIndex],
        }),
        id: nanoid(12),
        name: messages.boardView,
        position: 1,
        type: 'board',
      })
    }

    await db.insert(databaseViews).values(
      views.map((view) => ({ ...view, databaseId, createdAt: stamp })),
    )

    const children = plan.pages.filter(
      (candidate) => candidate.parentKey === page.key,
    )

    for (const child of children) {
      const childId = idByKey.get(child.key)
      const importedValues = plan.rowValuesByKey?.get(child.key)

      if (!childId) {
        continue
      }

      const values: Record<string, PropertyValue> = {}

      for (const [index, property] of schema.properties.entries()) {
        const value = toPropertyValue(
          importedValues?.[index] ?? null,
          property.type,
          property.options,
        )

        if (value !== null) {
          values[propertyIds[index]] = value
        }
      }

      await db
        .update(documents)
        .set({ kind: 'row', properties: serializeValues(values) })
        .where(eq(documents.id, childId))
    }
  }

  async function materializeCsvDatabase(page: NotionPage): Promise<number> {
    const databaseId = idByKey.get(page.key)

    if (!databaseId || !page.sourcePath) {
      return 0
    }

    const inferred = inferDatabase(
      parseCsv(plan.csvByPath.get(page.sourcePath) ?? ''),
      messages.csvColumn,
      people,
    )

    if (!inferred) {
      return 0
    }

    for (const name of inferred.unresolvedPeople) {
      unresolvedPeople.add(name)
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
      config: serializeViewConfig(emptyViewConfig),
      position: 0,
      createdAt: stamp,
    })

    const children = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(
        and(eq(documents.parentId, databaseId), isNull(documents.deletedAt)),
      )

    const matcher = createRowMatcher(children)
    const matched = new Set<string>()
    let added = 0

    for (const row of inferred.rows.slice(0, MAX_DATABASE_ROWS)) {
      const values: Record<string, PropertyValue> = {}

      for (const [index, value] of row.values.entries()) {
        if (value !== undefined) {
          values[propertyIds[index]] = value as PropertyValue
        }
      }

      const existing = matcher.take(row.title)

      if (existing) {
        matched.add(existing)

        await db
          .update(documents)
          .set({
            kind: 'row',
            title: row.title.slice(0, 200),
            properties: serializeValues(values),
          })
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
      if (page.kind === 'blocks') {
        const source = plan.blocksByPath?.get(page.sourcePath ?? '') ?? []
        const rewritten = rewriteImportedBlocks(source, resolveNative)
        missingLinks += rewritten.missing

        await db
          .update(documents)
          .set({
            content: JSON.stringify(sanitizeBlocks(rewritten.blocks)),
          })
          .where(eq(documents.id, id))
      } else if (!plan.databasesByKey?.has(page.key)) {
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
      }

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
      if (plan.databasesByKey?.has(page.key)) {
        await materializeNativeDatabase(page)
      } else {
        created += await materializeCsvDatabase(page)
      }

      databases += 1
    } catch {
      warn(messages.pageFailed(page.title))
    }
  }

  if (threadsByPageKey && threadsByPageKey.size > 0) {
    try {
      const imported = await importComments(threadsByPageKey, idByKey)

      if (imported > 0) {
        warn(messages.commentsImported(imported))
      }
    } catch {
      warn(messages.commentsFailed)
    }
  }

  if (databases > 0) {
    warn(messages.csvDatabases(databases))
  }

  if (toggles > 0) {
    warn(messages.togglesDegraded(toggles))
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

import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { csvToMarkdownTable } from '@/lib/notion/csv'
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

    if (page.kind === 'csv' && page.sourcePath) {
      const table = csvToMarkdownTable(plan.csvByPath.get(page.sourcePath) ?? '')

      if (!table) {
        return ''
      }

      const notes: Array<string> = []

      if (table.truncatedColumns || table.truncatedRows) {
        notes.push(messages.tableTruncated(table.columns, table.rows))
      }

      return [table.markdown, ...notes].join('\n\n')
    }

    return ''
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

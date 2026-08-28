import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { csvToMarkdownTable } from '@/lib/notion/csv'
import { MAX_ASSET_BYTES, MAX_ASSET_LABEL } from '@/lib/notion/limits'
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

export type ImportOwner = Readonly<{ id: string }>

function assetKeyFor(path: string) {
  const extension = extensionOf(path)

  return `u/${nanoid(16)}${extension.length > 0 ? extension : '.bin'}`
}

export async function* importNotionZip(
  data: Uint8Array,
  owner: ImportOwner,
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
    plan = buildImportPlan(readZipEntries(data))
  } catch (error) {
    yield {
      type: 'error',
      error:
        error instanceof NotionImportError
          ? error.message
          : 'Não foi possível ler esse arquivo zip.',
    }

    return
  }

  if (plan.pages.length === 0) {
    yield {
      type: 'error',
      error: 'Não encontramos páginas do Notion nesse arquivo.',
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
      warn(`${asset.fileName} passa de ${MAX_ASSET_LABEL} e ficou de fora.`)
    } else {
      const key = assetKeyFor(asset.path)

      try {
        await storage.put(key, Buffer.from(asset.bytes), asset.contentType)
        assetUrls.set(asset.path, `/api/uploads/${key}`)
        uploaded += 1
      } catch {
        warn(`Não foi possível enviar o arquivo ${asset.fileName}.`)
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
    parentId: page.parentKey ? (idByKey.get(page.parentKey) ?? null) : null,
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
        notes.push(
          `Tabela truncada na importação: ${table.columns} colunas e ${table.rows} linhas.`,
        )
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
      warn(`Não foi possível converter a página ${page.title}.`)
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
    warn(
      `${toggles} listas de alternância viraram título em negrito com o conteúdo aberto.`,
    )
  }

  if (missingLinks > 0) {
    warn(`${missingLinks} links internos não tinham destino no arquivo e viraram texto.`)
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

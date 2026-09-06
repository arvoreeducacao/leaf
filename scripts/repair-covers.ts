import { createConnection } from 'mysql2/promise'
import type { Connection, RowDataPacket } from 'mysql2/promise'

import { normalizeCover, notionCoverValue } from '@/lib/document-cover'
import { createNotionClient } from '@/lib/notion/api'
import type { NotionClient } from '@/lib/notion/api'
import { assetKeyFor } from '@/lib/notion/paths'
import { MAX_ASSET_BYTES } from '@/lib/notion/limits'
import { storage } from '@/lib/storage'

type Mode = 'dry-run' | 'apply'

type Target = {
  documentId: string
  notionId: string
  kind: 'page' | 'database' | 'row'
  title: string
}

const pauseBetweenReads = 330

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function modeOf(argv: ReadonlyArray<string>): Mode {
  return argv.includes('--apply') ? 'apply' : 'dry-run'
}

function limitOf(argv: ReadonlyArray<string>): number | null {
  const flag = argv.find((value) => value.startsWith('--limit='))

  return flag ? Number(flag.split('=')[1]) : null
}

function includesRows(argv: ReadonlyArray<string>): boolean {
  return argv.includes('--rows')
}

function onlyDocumentOf(argv: ReadonlyArray<string>): string | null {
  const flag = argv.find((value) => value.startsWith('--document='))

  return flag ? flag.split('=')[1] : null
}

async function query<T extends RowDataPacket>(
  connection: Connection,
  sql: string,
  values: ReadonlyArray<unknown> = [],
): Promise<Array<T>> {
  const [rows] = await connection.query<Array<T>>(sql, values as Array<unknown>)

  return rows
}

async function loadTargets(
  connection: Connection,
  withRows: boolean,
  limit: number | null,
  onlyDocument: string | null,
): Promise<Array<Target>> {
  const kinds = withRows ? ['page', 'database', 'row'] : ['page', 'database']
  const rows = await query<RowDataPacket>(
    connection,
    `select nd.document_id as documentId,
            nd.notion_id as notionId,
            nd.kind as kind,
            d.title as title
       from notion_documents nd
       join documents d
         on d.id = nd.document_id
        and d.deleted_at is null
      where nd.kind in (?)
        and (d.cover is null or d.cover = '')
        and (? is null or d.id = ?)
      order by nd.kind`,
    [kinds, onlyDocument, onlyDocument],
  )

  const targets = rows.map((row) => ({
    documentId: String(row.documentId),
    kind: String(row.kind) as Target['kind'],
    notionId: String(row.notionId),
    title: String(row.title),
  }))

  return limit === null ? targets : targets.slice(0, limit)
}

async function storedCover(
  client: NotionClient,
  url: string,
): Promise<string | null> {
  const { bytes, contentType } = await client.download(url)

  if (bytes.byteLength > MAX_ASSET_BYTES) {
    return null
  }

  const key = assetKeyFor(new URL(url).pathname)

  await storage.put(key, Buffer.from(bytes), contentType)

  return `/api/uploads/${key}`
}

async function main() {
  const mode = modeOf(process.argv)
  const limit = limitOf(process.argv)
  const withRows = includesRows(process.argv)
  const onlyDocument = onlyDocumentOf(process.argv)
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL ausente')
  }

  const connection = await createConnection(url)
  const tokens = await query<RowDataPacket>(
    connection,
    'select access_token as token from notion_connections order by updated_at desc limit 1',
  )

  if (tokens.length === 0) {
    throw new Error('nenhuma conexão do Notion salva')
  }

  const client = createNotionClient(String(tokens[0].token))
  const targets = await loadTargets(connection, withRows, limit, onlyDocument)

  let read = 0
  let found = 0
  let written = 0
  let gone = 0
  let failed = 0

  for (const target of targets) {
    read += 1

    await wait(pauseBetweenReads)

    let source

    try {
      source =
        target.kind === 'database'
          ? await client.database(target.notionId)
          : await client.page(target.notionId)
    } catch {
      gone += 1
      continue
    }

    let toDownload: string | null = null
    const value = notionCoverValue(source.cover, (fileUrl: string) => {
      toDownload = fileUrl

      return fileUrl
    })

    if (value === null) {
      continue
    }

    found += 1

    let cover: string | null = null

    if (toDownload === null) {
      cover = normalizeCover(value)
    } else if (mode === 'apply') {
      try {
        cover = await storedCover(client, toDownload)
      } catch {
        cover = null
      }
    } else {
      cover = toDownload
    }

    if (!cover) {
      failed += 1
      continue
    }

    if (mode === 'apply') {
      await connection.execute('update documents set cover = ? where id = ?', [
        cover,
        target.documentId,
      ])
    }

    written += 1

    if (written % 20 === 0) {
      console.log(`${written} capas · ${read}/${targets.length} lidos`)
    }
  }

  console.log('')
  console.log(`documentos sem capa: ${targets.length}`)
  console.log(`lidos no Notion: ${read}`)
  console.log(`com capa no Notion: ${found}`)
  console.log(`capas gravadas: ${written}`)
  console.log(`já não existem no Notion: ${gone}`)
  console.log(`capas que não deram para trazer: ${failed}`)
  console.log(mode === 'apply' ? 'aplicado' : 'nada foi escrito (use --apply)')

  await connection.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

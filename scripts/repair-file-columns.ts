import { createConnection } from 'mysql2/promise'
import type { Connection, RowDataPacket } from 'mysql2/promise'

import { UPLOAD_PREFIX } from '@/lib/database/forms'
import {
  MAX_FILES_PER_VALUE,
  parseValues,
  serializeValues,
} from '@/lib/database/values'
import type { PropertyValue } from '@/lib/database/values'

type Mode = 'dry-run' | 'apply'

type Candidate = {
  propertyId: string
  propertyName: string
  databaseId: string
  databaseTitle: string
  rows: Array<{ documentId: string; urls: Array<string> }>
}

function modeOf(argv: ReadonlyArray<string>): Mode {
  return argv.includes('--apply') ? 'apply' : 'dry-run'
}

async function query<T extends RowDataPacket>(
  connection: Connection,
  sql: string,
  values: ReadonlyArray<unknown> = [],
): Promise<Array<T>> {
  const [rows] = await connection.query<Array<T>>(sql, values as Array<unknown>)

  return rows
}

function storedUrlsOf(value: PropertyValue): Array<string> | null {
  const list =
    typeof value === 'string'
      ? value.split('\n')
      : Array.isArray(value)
        ? [...value]
        : []

  const urls = list
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)

  if (urls.length === 0) {
    return []
  }

  return urls.every((url) => url.startsWith(UPLOAD_PREFIX) && !url.includes('..'))
    ? urls.slice(0, MAX_FILES_PER_VALUE)
    : null
}

async function loadCandidates(connection: Connection): Promise<Array<Candidate>> {
  const properties = await query<RowDataPacket>(
    connection,
    `select p.id as propertyId,
            p.name as propertyName,
            p.database_id as databaseId,
            d.title as databaseTitle
       from database_properties p
       join documents d
         on d.id = p.database_id
        and d.deleted_at is null
      where p.type = 'text'`,
  )

  const candidates: Array<Candidate> = []

  for (const property of properties) {
    const databaseId = String(property.databaseId)
    const propertyId = String(property.propertyId)

    const rows = await query<RowDataPacket>(
      connection,
      `select id, properties
         from documents
        where parent_id = ?
          and kind = 'row'
          and deleted_at is null
          and properties is not null`,
      [databaseId],
    )

    const touched: Array<{ documentId: string; urls: Array<string> }> = []
    let clean = true

    for (const row of rows) {
      const values = parseValues(String(row.properties))
      const urls = storedUrlsOf(values[propertyId] ?? null)

      if (urls === null) {
        clean = false
        break
      }

      if (urls.length > 0) {
        touched.push({ documentId: String(row.id), urls })
      }
    }

    if (clean && touched.length > 0) {
      candidates.push({
        databaseId,
        databaseTitle: String(property.databaseTitle),
        propertyId,
        propertyName: String(property.propertyName),
        rows: touched,
      })
    }
  }

  return candidates
}

async function main() {
  const mode = modeOf(process.argv)
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL ausente')
  }

  const connection = await createConnection(url)
  const candidates = await loadCandidates(connection)

  let cells = 0

  for (const candidate of candidates) {
    cells += candidate.rows.length
    console.log(
      `${candidate.databaseTitle} · ${candidate.propertyName} · ${candidate.rows.length} células`,
    )

    if (mode !== 'apply') {
      continue
    }

    await connection.execute(
      'update database_properties set type = ? where id = ?',
      ['files', candidate.propertyId],
    )

    for (const row of candidate.rows) {
      const current = await query<RowDataPacket>(
        connection,
        'select properties from documents where id = ?',
        [row.documentId],
      )

      if (current.length === 0) {
        continue
      }

      const values = { ...parseValues(String(current[0].properties)) }

      values[candidate.propertyId] = row.urls

      await connection.execute(
        'update documents set properties = ? where id = ?',
        [serializeValues(values), row.documentId],
      )
    }
  }

  console.log('')
  console.log(`colunas de arquivo encontradas: ${candidates.length}`)
  console.log(`células com anexo: ${cells}`)
  console.log(mode === 'apply' ? 'aplicado' : 'nada foi escrito (use --apply)')

  await connection.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

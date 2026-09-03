import { createConnection } from 'mysql2/promise'
import type { Connection, RowDataPacket } from 'mysql2/promise'
import { createNotionClient } from '@/lib/notion/api'
import type { NotionClient, NotionPageObject } from '@/lib/notion/api'
import { importedValue, mapDatabaseProperties } from '@/lib/notion/properties'
import type { ImportedProperty, ImportedValue } from '@/lib/notion/properties'
import {
  MAX_PROPERTY_NAME,
  MAX_TEXT_VALUE,
  parseOptions,
  serializeValues,
} from '@/lib/database/values'
import type {
  PropertyValue,
  PropertyValues,
  SelectOption,
} from '@/lib/database/values'
import type { DatabasePropertyType } from '@/db/schema'

type Mode = 'verify' | 'dry-run' | 'apply'

type StrayRow = {
  documentId: string
  databaseDocumentId: string
  notionId: string
}

type StoredProperty = {
  id: string
  name: string
  type: DatabasePropertyType
  options: Array<SelectOption>
}

type PendingRelation = {
  documentId: string
  propertyId: string
  notionIds: ReadonlyArray<string>
  values: Record<string, PropertyValue>
}

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, '').toLowerCase()
}

function modeOf(argv: ReadonlyArray<string>): Mode {
  if (argv.includes('--apply')) {
    return 'apply'
  }

  if (argv.includes('--verify')) {
    return 'verify'
  }

  return 'dry-run'
}

function limitOf(argv: ReadonlyArray<string>): number | null {
  const flag = argv.find((value) => value.startsWith('--databases='))

  return flag ? Number(flag.split('=')[1]) : null
}

async function query<T extends RowDataPacket>(
  connection: Connection,
  sql: string,
  values: ReadonlyArray<unknown> = [],
): Promise<Array<T>> {
  const [rows] = await connection.query<Array<T>>(sql, values as Array<unknown>)

  return rows
}

async function loadStrayRows(connection: Connection): Promise<Array<StrayRow>> {
  const rows = await query<RowDataPacket>(
    connection,
    `select d.id as documentId,
            d.parent_id as databaseDocumentId,
            nd.notion_id as notionId
       from documents d
       join documents p
         on p.id = d.parent_id
        and p.kind = 'database'
        and p.deleted_at is null
       join notion_documents nd
         on nd.document_id = d.id
      where d.kind = 'page'
        and d.deleted_at is null`,
  )

  return rows.map((row) => ({
    databaseDocumentId: String(row.databaseDocumentId),
    documentId: String(row.documentId),
    notionId: String(row.notionId),
  }))
}

async function loadHealthyRows(
  connection: Connection,
  databaseDocumentId: string,
  limit: number,
): Promise<Array<StrayRow & { properties: string | null }>> {
  const rows = await query<RowDataPacket>(
    connection,
    `select d.id as documentId,
            d.parent_id as databaseDocumentId,
            d.properties as properties,
            nd.notion_id as notionId
       from documents d
       join notion_documents nd
         on nd.document_id = d.id
      where d.parent_id = ?
        and d.kind = 'row'
        and d.deleted_at is null
        and d.properties is not null
      limit ?`,
    [databaseDocumentId, limit],
  )

  return rows.map((row) => ({
    databaseDocumentId: String(row.databaseDocumentId),
    documentId: String(row.documentId),
    notionId: String(row.notionId),
    properties: row.properties === null ? null : String(row.properties),
  }))
}

async function loadNotionIdByDocument(
  connection: Connection,
): Promise<Map<string, string>> {
  const rows = await query<RowDataPacket>(
    connection,
    'select document_id as documentId, notion_id as notionId from notion_documents',
  )

  return new Map(rows.map((row) => [String(row.documentId), String(row.notionId)]))
}

async function loadDocumentByNotionId(
  connection: Connection,
): Promise<Map<string, string>> {
  const rows = await query<RowDataPacket>(
    connection,
    'select document_id as documentId, notion_id as notionId from notion_documents',
  )

  return new Map(
    rows.map((row) => [
      normalizeNotionId(String(row.notionId)),
      String(row.documentId),
    ]),
  )
}

async function loadStoredProperties(
  connection: Connection,
  databaseDocumentId: string,
): Promise<Array<StoredProperty>> {
  const rows = await query<RowDataPacket>(
    connection,
    `select id, name, type, options
       from database_properties
      where database_id = ?
      order by position`,
    [databaseDocumentId],
  )

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    options: parseOptions(row.options === null ? null : String(row.options)),
    type: String(row.type) as DatabasePropertyType,
  }))
}

async function loadPeople(
  connection: Connection,
): Promise<Map<string, string>> {
  const rows = await query<RowDataPacket>(
    connection,
    `select u.id as id, u.email as email, u.name as name
       from user u
       join organization_members m on m.user_id = u.id`,
  )
  const byLabel = new Map<string, string>()

  for (const row of rows) {
    const id = String(row.id)
    const email = String(row.email ?? '').toLowerCase()
    const name = String(row.name ?? '').toLowerCase()

    if (email) {
      byLabel.set(email, id)
    }

    if (name && !byLabel.has(name)) {
      byLabel.set(name, id)
    }
  }

  return byLabel
}

async function loadTitles(
  connection: Connection,
  documentIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const titles = new Map<string, string>()

  for (let index = 0; index < documentIds.length; index += 200) {
    const slice = documentIds.slice(index, index + 200)

    if (slice.length === 0) {
      continue
    }

    const rows = await query<RowDataPacket>(
      connection,
      `select id, title from documents where id in (${slice.map(() => '?').join(',')})`,
      slice,
    )

    for (const row of rows) {
      titles.set(String(row.id), String(row.title))
    }
  }

  return titles
}

function toPropertyValue(
  value: ImportedValue,
  type: DatabasePropertyType,
  options: ReadonlyArray<SelectOption>,
  peopleByLabel: Map<string, string>,
): PropertyValue | { relation: ReadonlyArray<string> } {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object' && 'relation' in value) {
    return value
  }

  if (type === 'select' || type === 'status') {
    return typeof value === 'string'
      ? (options.find((option) => option.name === value)?.id ?? null)
      : null
  }

  if (type === 'multiSelect') {
    return Array.isArray(value)
      ? value.flatMap((name) => {
          const option = options.find((candidate) => candidate.name === name)

          return option ? [option.id] : []
        })
      : []
  }

  if (type === 'person') {
    return Array.isArray(value)
      ? value.flatMap((label) => {
          const id = peopleByLabel.get(String(label).toLowerCase())

          return id ? [id] : []
        })
      : []
  }

  return value as PropertyValue
}

async function valuesForRow(
  row: NotionPageObject,
  properties: ReadonlyArray<ImportedProperty>,
  storedByName: Map<string, StoredProperty>,
  peopleByLabel: Map<string, string>,
  client: NotionClient,
  authors: Map<string, string | null>,
  documentId: string,
  pending: Array<PendingRelation>,
): Promise<Record<string, PropertyValue>> {
  const values: Record<string, PropertyValue> = {}

  for (const property of properties) {
    const stored = storedByName.get(property.name.slice(0, MAX_PROPERTY_NAME))

    if (!stored) {
      continue
    }

    const raw = await importedValue(
      property,
      (row.properties as Record<string, unknown> | undefined)?.[
        property.notionName
      ],
      {
        personLabel: async (personId: string) => {
          if (!authors.has(personId)) {
            try {
              const author = await client.user(personId)

              authors.set(personId, author.person?.email ?? author.name ?? null)
            } catch {
              authors.set(personId, null)
            }
          }

          return authors.get(personId) ?? null
        },
        registerAsset: () => null,
      },
    )
    const options =
      property.options.length > 0 ? property.options : stored.options
    const converted = toPropertyValue(
      raw,
      stored.type,
      options,
      peopleByLabel,
    )

    if (
      converted &&
      typeof converted === 'object' &&
      'relation' in converted
    ) {
      pending.push({
        documentId,
        notionIds: converted.relation,
        propertyId: stored.id,
        values,
      })
      continue
    }

    if (converted !== null) {
      values[stored.id] = converted
    }
  }

  return values
}

function sameValues(left: PropertyValues, right: PropertyValues): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function main() {
  const mode = modeOf(process.argv)
  const databaseLimit = limitOf(process.argv)
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
  const strays = await loadStrayRows(connection)
  const notionIdByDocument = await loadNotionIdByDocument(connection)
  const documentByNotionId = await loadDocumentByNotionId(connection)
  const peopleByLabel = await loadPeople(connection)
  const authors = new Map<string, string | null>()
  const byDatabase = new Map<string, Array<StrayRow>>()

  for (const stray of strays) {
    const list = byDatabase.get(stray.databaseDocumentId) ?? []

    list.push(stray)
    byDatabase.set(stray.databaseDocumentId, list)
  }

  const databaseIds = [...byDatabase.keys()].slice(
    0,
    databaseLimit ?? byDatabase.size,
  )

  console.log(
    `modo=${mode} bases=${databaseIds.length} linhas=${strays.length}`,
  )

  const pending: Array<PendingRelation> = []
  let repaired = 0
  let missingInNotion = 0
  let unreadableDatabases = 0
  let verified = 0
  let mismatched = 0
  const filesProperties = new Set<string>()

  for (const [index, databaseDocumentId] of databaseIds.entries()) {
    const databaseNotionId = notionIdByDocument.get(databaseDocumentId)

    if (!databaseNotionId) {
      unreadableDatabases += 1
      continue
    }

    let schema

    try {
      schema = await client.database(databaseNotionId)
    } catch (error) {
      unreadableDatabases += 1
      console.log(`  base ilegível ${databaseDocumentId}: ${String(error)}`)
      continue
    }

    const properties = mapDatabaseProperties(schema.properties ?? {})
    const stored = await loadStoredProperties(connection, databaseDocumentId)
    const storedByName = new Map(
      stored.map((property) => [property.name, property]),
    )

    for (const property of properties) {
      if (property.notionType === 'files') {
        filesProperties.add(`${databaseDocumentId}:${property.name}`)
      }
    }

    const targets = new Map(
      (byDatabase.get(databaseDocumentId) ?? []).map((stray) => [
        normalizeNotionId(stray.notionId),
        stray,
      ]),
    )
    const sample =
      mode === 'verify'
        ? new Map(
            (await loadHealthyRows(connection, databaseDocumentId, 5)).map(
              (row) => [normalizeNotionId(row.notionId), row],
            ),
          )
        : new Map()
    const seen = new Set<string>()

    for await (const row of client.rows(databaseNotionId)) {
      const key = normalizeNotionId(row.id)
      const target = targets.get(key)
      const healthy = sample.get(key)

      if (!target && !healthy) {
        continue
      }

      seen.add(key)

      const documentId = target ? target.documentId : healthy.documentId
      const local: Array<PendingRelation> = []
      const values = await valuesForRow(
        row,
        properties,
        storedByName,
        peopleByLabel,
        client,
        authors,
        documentId,
        target ? pending : local,
      )

      if (healthy && !target) {
        verified += 1

        for (const item of local) {
          const documentIds = item.notionIds.flatMap((notionId) => {
            const mapped = documentByNotionId.get(normalizeNotionId(notionId))

            return mapped ? [mapped] : []
          })

          if (documentIds.length === 0) {
            continue
          }

          const titles = await loadTitles(connection, documentIds)
          const label = [...titles.values()].join(', ').slice(0, MAX_TEXT_VALUE)

          if (label.length > 0) {
            item.values[item.propertyId] = label
          }
        }

        if (
          !sameValues(
            values as PropertyValues,
            JSON.parse(healthy.properties ?? '{}') as PropertyValues,
          )
        ) {
          mismatched += 1
          console.log(
            `  divergente ${documentId}\n    calculado ${JSON.stringify(values)}\n    guardado  ${healthy.properties}`,
          )
        }

        continue
      }

      repaired += 1

      if (mode === 'apply') {
        await connection.execute(
          'update documents set properties = ?, kind = ? where id = ?',
          [serializeValues(values), 'row', documentId],
        )
        await connection.execute(
          'update notion_documents set kind = ? where document_id = ?',
          ['row', documentId],
        )
      }
    }

    for (const [key] of targets) {
      if (!seen.has(key)) {
        missingInNotion += 1
      }
    }

    if ((index + 1) % 20 === 0) {
      console.log(`  ${index + 1}/${databaseIds.length} bases`)
    }
  }

  let relationsWritten = 0

  for (const item of pending) {
    const documentIds = item.notionIds.flatMap((notionId) => {
      const documentId = documentByNotionId.get(normalizeNotionId(notionId))

      return documentId ? [documentId] : []
    })

    if (documentIds.length === 0) {
      continue
    }

    const titles = await loadTitles(connection, documentIds)
    const label = [...titles.values()].join(', ').slice(0, MAX_TEXT_VALUE)

    if (label.length === 0) {
      continue
    }

    item.values[item.propertyId] = label
    relationsWritten += 1

    if (mode === 'apply') {
      await connection.execute(
        'update documents set properties = ? where id = ?',
        [serializeValues(item.values), item.documentId],
      )
    }
  }

  console.log('')
  console.log(`linhas reparáveis: ${repaired}`)
  console.log(`linhas que não existem mais no Notion: ${missingInNotion}`)
  console.log(`bases ilegíveis pela API: ${unreadableDatabases}`)
  console.log(`referências entre bases preenchidas: ${relationsWritten}`)
  console.log(`colunas de arquivo afetadas: ${filesProperties.size}`)

  if (mode === 'verify') {
    console.log(`linhas boas conferidas: ${verified}, divergentes: ${mismatched}`)
  }

  await connection.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

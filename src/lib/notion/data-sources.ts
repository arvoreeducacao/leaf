import type {
  NotionClient,
  NotionDatabaseObject,
  NotionPropertyConfig,
} from '@/lib/notion/api'

export type DatabaseSource = Readonly<{
  id: string
  name: string | null
  properties: Record<string, NotionPropertyConfig>
}>

export type DatabaseParent = Readonly<{
  type?: string
  page_id?: string
  database_id?: string
  data_source_id?: string
  block_id?: string
}>

export async function loadDatabaseSources(
  client: NotionClient,
  database: NotionDatabaseObject,
): Promise<Array<DatabaseSource>> {
  const refs = database.data_sources ?? []

  if (refs.length === 0) {
    return [{ id: database.id, name: null, properties: database.properties ?? {} }]
  }

  const sources: Array<DatabaseSource> = []

  for (const ref of refs) {
    const source = await client.dataSource(ref.id)

    sources.push({
      id: ref.id,
      name: ref.name?.trim() || null,
      properties: source.properties ?? {},
    })
  }

  return sources
}

export function sourceKey(
  databaseId: string,
  source: DatabaseSource,
  total: number,
): string {
  return total > 1 ? source.id : databaseId
}

export function sourceTitle(
  databaseTitle: string,
  source: DatabaseSource,
  total: number,
): string {
  return total > 1 && source.name
    ? `${databaseTitle} · ${source.name}`
    : databaseTitle
}

export function databaseIdOfParent(parent: DatabaseParent): string | null {
  if (parent.type === 'database_id' || parent.type === 'data_source_id') {
    return parent.database_id ?? null
  }

  return null
}

export function isDatabaseParent(parent: DatabaseParent): boolean {
  return parent.type === 'database_id' || parent.type === 'data_source_id'
}

export function createDatabaseResolver(client: NotionClient) {
  const byDataSource = new Map<string, string | null>()

  return async function resolveDatabaseId(
    parent: DatabaseParent,
  ): Promise<string | null> {
    const direct = databaseIdOfParent(parent)

    if (direct) {
      return direct
    }

    if (parent.type !== 'data_source_id' || !parent.data_source_id) {
      return null
    }

    const cached = byDataSource.get(parent.data_source_id)

    if (cached !== undefined) {
      return cached
    }

    let resolved: string | null = null

    try {
      const source = await client.dataSource(parent.data_source_id)
      const sourceParent = (source.parent ?? {}) as DatabaseParent

      resolved = sourceParent.database_id ?? null
    } catch {
      resolved = null
    }

    byDataSource.set(parent.data_source_id, resolved)

    return resolved
  }
}

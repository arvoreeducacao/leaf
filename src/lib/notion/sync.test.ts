import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  documents,
  notionDocuments,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseValues } from '@/lib/database/values'
import type {
  NotionBlock,
  NotionClient,
  NotionPageObject,
} from '@/lib/notion/api'
import type { NotionImportMessages } from '@/lib/notion/messages'
import { syncNotion } from '@/lib/notion/sync'

const rootId = '11111111-1111-1111-1111-111111111111'
const childId = '22222222-2222-2222-2222-222222222222'
const databaseId = '33333333-3333-3333-3333-333333333333'
const dataSourceId = '66666666-6666-6666-6666-666666666666'
const secondSourceId = '77777777-7777-7777-7777-777777777777'
const rowOneId = '44444444-4444-4444-4444-444444444444'
const rowTwoId = '55555555-5555-5555-5555-555555555555'
const imageUrl = 'https://files.notion.so/shot.png?sig=abc'

const messages: NotionImportMessages = {
  assetFailed: (name) => `asset ${name}`,
  assetTooLarge: (name, limit) => `${name} ${limit}`,
  boardView: 'Board',
  commentsFailed: 'comments failed',
  commentsImported: (count) => `${count} comments`,
  commentsUnavailable: 'comments unavailable',
  crawlTruncated: (max) => `stopped at ${max}`,
  csvColumn: 'Column',
  csvDatabases: (count) => `${count} databases`,
  csvView: 'Table',
  missingLinks: (count) => `${count} links`,
  noPages: 'no pages',
  pageFailed: (title) => `page ${title}`,
  skippedUnchanged: (count) => `${count} skipped`,
  togglesDegraded: (count) => `${count} toggles`,
  tooManyEntries: (max) => `${max} entries`,
  unreadableZip: 'bad zip',
  unresolvedPeople: (count, names) => `${count} unresolved: ${names}`,
  unsafePaths: 'bad path',
  unsupportedBlocks: (count, types) => `${count} unsupported: ${types}`,
  unzippedTooLarge: (limit) => `over ${limit}`,
  untitled: 'Untitled',
}

type World = {
  editedAt: Record<string, string>
  pageCalls: Array<string>
  search?: Array<Record<string, unknown>>
  childText: string
  dbInline: boolean
  dbDead?: boolean
  dbSources?: 'legacy' | 'two' | 'two-one-empty'
  brokenIds?: Array<string>
  rootIcon: { name: string; color: string } | null
  rootCover: { file?: { url: string }; external?: { url: string } } | null
  abortOnRows?: AbortController
}

function makeWorld(): World {
  return {
    childText: 'child body',
    pageCalls: [],
    dbInline: true,
    rootCover: null,
    rootIcon: { color: 'gray', name: 'alien-pixel' },
    editedAt: {
      [childId]: '2026-01-02T00:00:00.000Z',
      [databaseId]: '2026-01-03T00:00:00.000Z',
      [rootId]: '2026-01-01T00:00:00.000Z',
      [rowOneId]: '2026-01-04T00:00:00.000Z',
      [rowTwoId]: '2026-01-05T00:00:00.000Z',
    },
  }
}

function title(text: string) {
  return { Name: { title: [{ plain_text: text }], type: 'title' } }
}

function norm(id: string): string {
  return id.replace(/-/g, '')
}

const schema = {
          Name: { name: 'Name', type: 'title' },
          'Prints & Anexos': { name: 'Prints & Anexos', type: 'files' },
          Relacionada: { name: 'Relacionada', type: 'relation' },
          Status: {
            name: 'Status',
            status: {
              groups: [
                { name: 'To-do', option_ids: ['opt-open'] },
                { name: 'Complete', option_ids: ['opt-done'] },
              ],
              options: [
                { color: 'gray', id: 'opt-open', name: 'Open' },
                { color: 'green', id: 'opt-done', name: 'Done' },
              ],
            },
            type: 'status',
          },
        }

function makeClient(world: World): NotionClient {
  const pages: Record<string, () => NotionPageObject> = {
    [norm(childId)]: () => ({
      created_time: '2025-12-01T00:00:00.000Z',
      icon: { emoji: '🌿', type: 'emoji' },
      id: childId,
      last_edited_time: world.editedAt[childId],
      properties: title('Class A'),
    }),
    [norm(rootId)]: () => ({
      cover: world.rootCover ?? undefined,
      created_time: '2025-12-01T00:00:00.000Z',
      icon: world.rootIcon ? { icon: world.rootIcon, type: 'icon' } : undefined,
      id: rootId,
      last_edited_time: world.editedAt[rootId],
      properties: title('Reading plan'),
    }),
  }

  const rows: Record<string, () => NotionPageObject> = {
    [norm(rowOneId)]: () => ({
      created_time: '2025-12-01T00:00:00.000Z',
      id: rowOneId,
      last_edited_time: world.editedAt[rowOneId],
      properties: {
        ...title('First task'),
        'Prints & Anexos': {
          files: [
            { file: { url: 'https://files.notion.so/one.png?sig=1' }, name: 'one.png' },
            { external: { url: 'https://example.com/two.pdf' }, name: 'two.pdf' },
          ],
          type: 'files',
        },
        Relacionada: { relation: [{ id: rowTwoId }], type: 'relation' },
        Status: {
          status: { name: 'Done' },
          type: 'status',
        },
      },
    }),
    [norm(rowTwoId)]: () => ({
      created_time: '2025-12-01T00:00:00.000Z',
      id: rowTwoId,
      last_edited_time: world.editedAt[rowTwoId],
      properties: {
        ...title('Second task'),
        Status: { status: { name: 'Open' }, type: 'status' },
      },
    }),
  }

  const blocks: Record<string, () => Array<NotionBlock>> = {
    [norm(childId)]: () => [
      {
        id: 'b-child',
        paragraph: {
          rich_text: [{ annotations: {}, plain_text: world.childText }],
        },
        type: 'paragraph',
      },
      {
        id: 'b-image',
        image: { caption: [], file: { url: imageUrl } },
        type: 'image',
      },
    ],
    [norm(rootId)]: () => [
      {
        id: 'b-link',
        paragraph: {
          rich_text: [
            {
              href: `https://www.notion.so/Class-${childId.replace(/-/g, '')}`,
              annotations: {},
              plain_text: 'see the class',
            },
          ],
        },
        type: 'paragraph',
      },
      { child_page: { title: 'Class A' }, id: childId, type: 'child_page' },
      {
        child_database: { title: 'Tasks' },
        id: databaseId,
        type: 'child_database',
      },
    ],
  }

  return {
    children: async function* (id: string) {
      if (world.brokenIds?.some((broken) => norm(broken) === norm(id))) {
        throw new Error(`blocks of ${id} unavailable`)
      }

      for (const block of blocks[norm(id)]?.() ?? []) {
        yield block
      }
    },
    comments: async function* () {},
    database: async (id: string) => {
      if (world.dbDead || norm(id) !== norm(databaseId)) {
        throw new Error(`no database ${id}`)
      }

      const base = {
        created_time: '2025-12-01T00:00:00.000Z',
        id: databaseId,
        is_inline: world.dbInline,
        last_edited_time: world.editedAt[databaseId],
        title: [{ plain_text: 'Tasks' }],
      }

      if (world.dbSources === 'legacy') {
        return { ...base, properties: schema }
      }

      if (world.dbSources === 'two' || world.dbSources === 'two-one-empty') {
        return {
          ...base,
          data_sources: [
            { id: dataSourceId, name: 'Ativas' },
            { id: secondSourceId, name: 'Arquivadas' },
          ],
        }
      }

      return { ...base, data_sources: [{ id: dataSourceId, name: 'Tasks' }] }
    },
    dataSource: async (id: string) => {
      if (norm(id) !== norm(dataSourceId) && norm(id) !== norm(secondSourceId)) {
        throw new Error(`no data source ${id}`)
      }

      return {
        id,
        parent: { database_id: databaseId, type: 'database_id' },
        properties: schema,
      }
    },
    download: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    }),
    page: async (id: string) => {
      world.pageCalls.push(norm(id))

      const page = pages[norm(id)]

      if (!page) {
        throw new Error(`no page ${id}`)
      }

      return page()
    },
    rows: async function* (id: string) {
      world.abortOnRows?.abort()

      if (world.dbSources === 'two') {
        if (norm(id) === norm(dataSourceId)) {
          yield rows[norm(rowOneId)]()
        }

        if (norm(id) === norm(secondSourceId)) {
          yield rows[norm(rowTwoId)]()
        }

        return
      }

      if (world.dbSources === 'two-one-empty') {
        if (norm(id) === norm(dataSourceId)) {
          yield rows[norm(rowOneId)]()
          yield rows[norm(rowTwoId)]()
        }

        return
      }

      const expected = world.dbSources === 'legacy' ? databaseId : dataSourceId

      if (norm(id) === norm(expected)) {
        yield rows[norm(rowOneId)]()
        yield rows[norm(rowTwoId)]()
      }
    },
    search: async function* () {
      if (world.search) {
        for (const result of world.search) {
          yield result as never
        }

        return
      }

      yield { id: rootId, object: 'page', parent: { type: 'workspace' } }
      yield {
        id: childId,
        object: 'page',
        parent: { block_id: 'col-1', type: 'block_id' },
      }
    },
    user: async () => ({ id: 'u1', name: 'Someone' }),
  }
}

const owner = { id: 'user-owner', orgAccess: null, orgId: null }

async function run(
  world: World,
  roots:
    | Array<{ id: string; kind: 'page' | 'database' }>
    | 'workspace' = [{ id: rootId, kind: 'page' }],
  extra: { force?: boolean } = {},
) {
  const events: Array<Record<string, unknown>> = []

  for await (const event of syncNotion(
    makeClient(world),
    roots,
    owner,
    messages,
    undefined,
    {
      ...extra,
      storeAsset: async (_bytes, _contentType, fileName) =>
        `/api/uploads/u/${fileName}`,
    },
  )) {
    events.push(event as Record<string, unknown>)
  }

  const done = events.find((event) => event.type === 'done') as {
    summary: { pages: number; assets: number; warnings: Array<string> }
  }

  return done.summary
}

beforeEach(async () => {
  await resetDatabase()

  await db.delete(documents)
  await db.delete(notionDocuments)
  await db.delete(user)
  await db.insert(user).values({
    id: owner.id,
    name: 'Owner',
    email: 'owner@example.com',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('resumable Notion sync', () => {
  it('imports each data source of a database as its own Leaf database', async () => {
    const world = makeWorld()
    world.dbSources = 'two'

    await run(world)


    const databases = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'database'))
    const titles = databases.map((row) => row.title).sort()

    expect(titles).toEqual(['Tasks · Arquivadas', 'Tasks · Ativas'])

    const active = databases.find((row) => row.title === 'Tasks · Ativas')
    const archived = databases.find((row) => row.title === 'Tasks · Arquivadas')
    const rowOne = await db.query.documents.findFirst({
      where: eq(documents.title, 'First task'),
    })
    const rowTwo = await db.query.documents.findFirst({
      where: eq(documents.title, 'Second task'),
    })

    expect(rowOne?.parentId).toBe(active?.id)
    expect(rowTwo?.parentId).toBe(archived?.id)

    const mappings = await db.select().from(notionDocuments)
    const databaseKeys = mappings
      .filter((mapping) => mapping.kind === 'database')
      .map((mapping) => mapping.notionId)
      .sort()

    expect(databaseKeys).toEqual([norm(dataSourceId), norm(secondSourceId)].sort())
  })

  it('ignores an empty extra data source and keeps the plain database', async () => {
    const world = makeWorld()
    world.dbSources = 'two-one-empty'

    await run(world)

    const databases = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'database'))

    expect(databases.map((row) => row.title)).toEqual(['Tasks'])

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'row'))

    expect(rows).toHaveLength(2)

    const mappings = await db.select().from(notionDocuments)
    const databaseKeys = mappings
      .filter((mapping) => mapping.kind === 'database')
      .map((mapping) => mapping.notionId)

    expect(databaseKeys).toEqual([norm(databaseId)])
  })

  it('still reads a database served in the shape without data sources', async () => {
    const world = makeWorld()
    world.dbSources = 'legacy'

    await run(world)

    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'row'))

    expect(database?.kind).toBe('database')
    expect(rows).toHaveLength(2)
  })

  it('seeds rows found by the search through their data source parent', async () => {
    const world = makeWorld()

    world.search = [
      {
        id: rowOneId,
        object: 'page',
        parent: {
          data_source_id: dataSourceId,
          database_id: databaseId,
          type: 'data_source_id',
        },
      },
      {
        id: rowTwoId,
        object: 'page',
        parent: { data_source_id: dataSourceId, type: 'data_source_id' },
      },
    ]

    await run(world, 'workspace')

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'row'))

    expect(rows).toHaveLength(2)

    const databases = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'database'))

    expect(databases).toHaveLength(1)
    expect(databases[0].title).toBe('Tasks')
  })

  it('seeds a database listed by the search as a data source', async () => {
    const world = makeWorld()

    world.search = [
      {
        database_parent: { type: 'workspace' },
        id: dataSourceId,
        object: 'data_source',
        parent: { database_id: databaseId, type: 'database_id' },
      },
    ]

    await run(world, 'workspace')

    const databases = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'database'))

    expect(databases).toHaveLength(1)

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'row'))

    expect(rows).toHaveLength(2)
  })

  it('keeps database rows as rows when the search lists them before their database', async () => {
    const world = makeWorld()

    world.search = [
      {
        id: rowOneId,
        object: 'page',
        parent: { database_id: databaseId, type: 'database_id' },
      },
      {
        id: rowTwoId,
        object: 'page',
        parent: { database_id: databaseId, type: 'database_id' },
      },
    ]

    await run(world, 'workspace')

    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'row'))

    expect(rows).toHaveLength(2)

    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.name, 'Status'))
    const statusId = properties[0].id
    const first = rows.find((row) => row.title === 'First task')

    expect(parseValues(first?.properties ?? null)[statusId]).toBe('opt-done')

    const mappings = await db.select().from(notionDocuments)

    expect(
      mappings.filter((mapping) => mapping.kind === 'row'),
    ).toHaveLength(2)
  })

  it('imports the tree, resolves links and snapshots relations', async () => {
    const summary = await run(makeWorld())

    expect(summary.pages).toBe(5)

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })
    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })
    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })
    const rowOne = await db.query.documents.findFirst({
      where: eq(documents.title, 'First task'),
    })

    expect(child?.parentId).toBe(root?.id)
    expect(child?.icon).toBe('🌿')
    expect(root?.icon).toBe(
      'https://www.notion.so/icons/alien-pixel_gray.svg',
    )
    expect(database?.kind).toBe('database')
    expect(rowOne?.parentId).toBe(database?.id)

    expect(root?.content).toContain(`/doc/${child?.id}`)
    expect(root?.content).toContain(`"databaseId":"${database?.id}"`)
    expect(child?.content).toContain('/api/uploads/u/')

    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, database?.id ?? ''))
    const status = properties.find((property) => property.type === 'status')
    const values = parseValues(rowOne?.properties ?? null)

    expect(status).toBeTruthy()
    expect(values[status?.id ?? '']).toBe('opt-done')

    const relation = properties.find(
      (property) => property.name === 'Relacionada',
    )

    expect(values[relation?.id ?? '']).toBe('Second task')

    const mappings = await db.select().from(notionDocuments)

    expect(mappings).toHaveLength(5)
  })

  it('renders an inaccessible child database as a Notion link', async () => {
    const world = makeWorld()

    world.dbDead = true

    await run(world)

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(root?.content).not.toContain('"type":"database"')
    expect(root?.content).not.toContain('"databaseId":""')
    expect(root?.content).toContain('https://www.notion.so/')
    expect(root?.content).toContain('Tasks')
  })

  it('renders a full-page child database as a link, not an embed', async () => {
    const world = makeWorld()

    world.dbInline = false

    await run(world)

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })
    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })

    expect(root?.content).not.toContain('"type":"database"')
    expect(root?.content).toContain(`/doc/${database?.id}`)
    expect(root?.content).toContain('Tasks')
  })

  it('takes the icon from the listing instead of reading the page again', async () => {
    const world = makeWorld()

    const listing = (icon: unknown) => [
      {
        icon,
        id: rootId,
        last_edited_time: world.editedAt[rootId],
        object: 'page',
        parent: { type: 'workspace' },
        properties: title('Reading plan'),
      },
      {
        id: childId,
        last_edited_time: world.editedAt[childId],
        object: 'page',
        parent: { block_id: 'col-1', type: 'block_id' },
        properties: title('Class A'),
      },
    ]

    world.search = listing({ icon: world.rootIcon, type: 'icon' })

    await run(world, 'workspace')

    world.search = listing({
      icon: { color: 'gray', name: 'fireworks' },
      type: 'icon',
    })
    world.pageCalls = []

    const summary = await run(world, 'workspace')

    expect(summary.pages).toBe(0)
    expect(world.pageCalls).not.toContain(norm(rootId))

    const after = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(after?.icon).toBe('https://www.notion.so/icons/fireworks_gray.svg')
  })

  it('brings a Notion attachment column in as files, stored here', async () => {
    const world = makeWorld()

    await run(world, [{ id: databaseId, kind: 'database' }])

    const property = await db.query.databaseProperties.findFirst({
      where: eq(databaseProperties.name, 'Prints & Anexos'),
    })

    expect(property?.type).toBe('files')

    const row = await db.query.documents.findFirst({
      where: eq(documents.title, 'First task'),
    })
    const values = parseValues(row?.properties ?? null)

    expect(values[property?.id ?? '']).toEqual([
      '/api/uploads/u/one.png',
      '/api/uploads/u/two.pdf',
    ])
  })

  it('brings the page cover from Notion into the document', async () => {
    const world = makeWorld()

    world.rootCover = {
      file: { url: 'https://files.notion.so/cover.png?sig=1' },
    }

    await run(world)

    const page = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(page?.cover).toBe('/api/uploads/u/cover')
  })

  it('keeps an external cover as its own address', async () => {
    const world = makeWorld()

    world.rootCover = {
      external: { url: 'https://images.unsplash.com/photo-1' },
    }

    await run(world)

    const page = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(page?.cover).toBe('https://images.unsplash.com/photo-1')
  })

  it('stores a cover whose external address is a signed Notion one', async () => {
    const world = makeWorld()

    world.rootCover = {
      external: {
        url: 'https://img.notionusercontent.com/s3/capa.png?exp=1&sig=abc',
      },
    }

    await run(world)

    const page = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(page?.cover).toBe('/api/uploads/u/cover')
  })

  it('gives a cover to a page the rerun skips', async () => {
    const world = makeWorld()

    await run(world)

    const before = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(before?.cover).toBeNull()

    world.rootCover = {
      external: { url: 'https://images.unsplash.com/photo-2' },
    }

    const summary = await run(world)

    expect(summary.pages).toBe(0)

    const after = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(after?.cover).toBe('https://images.unsplash.com/photo-2')
  })

  it('never erases a cover chosen here because Notion has none', async () => {
    const world = makeWorld()

    world.rootCover = {
      external: { url: 'https://images.unsplash.com/photo-3' },
    }

    await run(world)

    world.rootCover = null

    await run(world)

    const page = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(page?.cover).toBe('https://images.unsplash.com/photo-3')
  })

  it('stores the image address before the run ends, not only at the end', async () => {
    const world = makeWorld()

    world.abortOnRows = new AbortController()

    for await (const _event of syncNotion(
      makeClient(world),
      [{ id: rootId, kind: 'page' }],
      owner,
      messages,
      world.abortOnRows.signal,
      {
        storeAsset: async (_bytes, _contentType, fileName) =>
          `/api/uploads/u/${fileName}`,
      },
    )) {
      continue
    }

    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(child?.content).toContain('/api/uploads/u/image')
    expect(child?.content).not.toContain('notion://asset/')
  })

  it('repairs the icon of a page the rerun skips', async () => {
    const world = makeWorld()

    await run(world)

    const before = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(before?.icon).toBe(
      'https://www.notion.so/icons/alien-pixel_gray.svg',
    )

    world.rootIcon = { color: 'blue', name: 'book' }

    const summary = await run(world)

    expect(summary.pages).toBe(0)

    const after = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(after?.icon).toBe('https://www.notion.so/icons/book_blue.svg')
  })

  it('gives an icon to a page that was imported without one', async () => {
    const world = makeWorld()

    world.rootIcon = null

    await run(world)

    const before = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(before?.icon).toBeNull()

    world.rootIcon = { color: 'gray', name: 'alien-pixel' }

    const summary = await run(world)

    expect(summary.pages).toBe(0)

    const after = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    expect(after?.icon).toBe(
      'https://www.notion.so/icons/alien-pixel_gray.svg',
    )
  })

  it('skips everything on a rerun with no changes', async () => {
    const world = makeWorld()

    await run(world)

    const childBefore = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    const summary = await run(world)

    expect(summary.pages).toBe(0)
    expect(
      summary.warnings.some((warning) => warning.includes('skipped')),
    ).toBe(true)

    const childAfter = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(childAfter?.updatedAt.getTime()).toBe(
      childBefore?.updatedAt.getTime(),
    )

    const all = await db.select({ id: documents.id }).from(documents)

    expect(all).toHaveLength(5)
  })

  it('nests block-parented pages under their ancestor in workspace mode', async () => {
    await run(makeWorld(), 'workspace')

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })
    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(root?.parentId).toBeNull()
    expect(child?.parentId).toBe(root?.id)
  })

  it('adopts the structural parent on a forced repair run', async () => {
    const world = makeWorld()

    await run(world, [{ id: childId, kind: 'page' }])

    const flattened = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(flattened?.parentId).toBeNull()

    await run(world, [{ id: rootId, kind: 'page' }], { force: true })

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })
    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(child?.parentId).toBe(root?.id)

    const all = await db.select({ id: documents.id }).from(documents)

    expect(all).toHaveLength(5)
  })

  it('re-imports only what changed since the last run', async () => {
    const world = makeWorld()

    await run(world)

    world.childText = 'edited body'
    world.editedAt[childId] = '2026-02-01T00:00:00.000Z'

    const summary = await run(world)

    expect(summary.pages).toBe(1)

    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(child?.content).toContain('edited body')

    const all = await db.select({ id: documents.id }).from(documents)

    expect(all).toHaveLength(5)
  })

  it('leaves no document behind when a page cannot be read', async () => {
    const world = makeWorld()

    world.brokenIds = [childId]

    const summary = await run(world)

    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })

    expect(child).toBeUndefined()
    expect(summary.warnings).toContain(`page ${childId}`)

    const all = await db.select({ id: documents.id }).from(documents)

    expect(all).toHaveLength(4)
  })

  it('skips a row that cannot be read and keeps the rest of the database', async () => {
    const world = makeWorld()

    world.brokenIds = [rowOneId]

    const summary = await run(world)

    const rowOne = await db.query.documents.findFirst({
      where: eq(documents.title, 'First task'),
    })
    const rowTwo = await db.query.documents.findFirst({
      where: eq(documents.title, 'Second task'),
    })

    expect(rowOne).toBeUndefined()
    expect(rowTwo?.kind).toBe('row')
    expect(summary.warnings).toContain(`page ${rowOneId}`)

    const all = await db.select({ id: documents.id }).from(documents)

    expect(all).toHaveLength(4)
  })
})

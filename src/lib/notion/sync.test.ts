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
  childText: string
}

function makeWorld(): World {
  return {
    childText: 'child body',
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
      created_time: '2025-12-01T00:00:00.000Z',
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
      for (const block of blocks[norm(id)]?.() ?? []) {
        yield block
      }
    },
    comments: async function* () {},
    database: async (id: string) => {
      if (norm(id) !== norm(databaseId)) {
        throw new Error(`no database ${id}`)
      }

      return {
        created_time: '2025-12-01T00:00:00.000Z',
        id: databaseId,
        last_edited_time: world.editedAt[databaseId],
        properties: {
          Name: { name: 'Name', type: 'title' },
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
        },
        title: [{ plain_text: 'Tasks' }],
      }
    },
    download: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    }),
    page: async (id: string) => {
      const page = pages[norm(id)]

      if (!page) {
        throw new Error(`no page ${id}`)
      }

      return page()
    },
    rows: async function* (id: string) {
      if (norm(id) === norm(databaseId)) {
        yield rows[norm(rowOneId)]()
        yield rows[norm(rowTwoId)]()
      }
    },
    search: async function* () {
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
    email: 'owner@arvore.com.br',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('resumable Notion sync', () => {
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
})

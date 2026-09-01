import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('@/lib/storage', () => ({
  storage: {
    put: async () => {},
    get: async () => null,
  },
}))

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documents,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseOptions, parseValues } from '@/lib/database/values'
import type { NotionImportMessages } from '@/lib/notion/messages'
import type { NotionPlan } from '@/lib/notion/plan'
import { importNotionPlan } from '@/lib/notion/import'

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
  togglesDegraded: (count) => `${count} toggles`,
  tooManyEntries: (max) => `${max} entries`,
  unreadableZip: 'bad zip',
  unresolvedPeople: (count, names) => `${count} unresolved: ${names}`,
  unsafePaths: 'bad path',
  unsupportedBlocks: (count, types) => `${count} unsupported: ${types}`,
  unzippedTooLarge: (limit) => `over ${limit}`,
  untitled: 'Untitled',
}

const databaseKey = 'db-1.csv'

function buildPlan(): NotionPlan {
  const pages = [
    {
      key: databaseKey,
      kind: 'csv' as const,
      parentKey: null,
      sourcePath: databaseKey,
      title: 'Tasks',
    },
    {
      key: 'row-1.md',
      kind: 'blocks' as const,
      parentKey: databaseKey,
      sourcePath: 'row-1.md',
      title: 'Write the report',
    },
    {
      key: 'row-2.md',
      kind: 'blocks' as const,
      parentKey: databaseKey,
      sourcePath: 'row-2.md',
      title: 'Review the report',
    },
  ]

  return {
    assets: [],
    blocksByPath: new Map([
      [
        'row-1.md',
        [
          {
            content: [
              { styles: {}, text: 'Body of the row page', type: 'text' },
            ],
            type: 'paragraph',
          },
        ],
      ],
      ['row-2.md', []],
    ]),
    csvByPath: new Map(),
    databasesByKey: new Map([
      [
        databaseKey,
        {
          properties: [
            {
              name: 'Status',
              notionName: 'Status',
              notionType: 'status',
              options: [
                {
                  color: 'gray' as const,
                  group: 'todo' as const,
                  id: 'opt-open',
                  name: 'Not started',
                },
                {
                  color: 'success' as const,
                  group: 'done' as const,
                  id: 'opt-done',
                  name: 'Done',
                },
              ],
              type: 'status' as const,
            },
            {
              name: 'Owners',
              notionName: 'Owners',
              notionType: 'people',
              options: [],
              type: 'person' as const,
            },
            {
              name: 'Task ID',
              notionName: 'Task ID',
              notionType: 'unique_id',
              options: [],
              type: 'text' as const,
            },
          ],
        },
      ],
    ]),
    markdownByPath: new Map(),
    metaByKey: new Map([
      [
        'row-1.md',
        {
          createdAt: new Date('2025-04-01T10:00:00.000Z'),
          icon: '📝',
          updatedAt: new Date('2026-02-02T12:00:00.000Z'),
        },
      ],
    ]),
    pages,
    pathToPageKey: new Map(pages.map((page) => [page.key, page.key])),
    rowValuesByKey: new Map([
      ['row-1.md', ['Not started', ['ana@arvore.com.br'], 'TASK-12']],
      ['row-2.md', ['Done', ['Someone Unknown'], 'TASK-13']],
    ]),
  }
}

beforeEach(async () => {
  await resetDatabase()

  await db.delete(documents)
  await db.delete(organizations)
  await db.delete(user)
  await db.insert(user).values([
    {
      id: 'user-owner',
      name: 'Owner',
      email: 'owner@arvore.com.br',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'user-ana',
      name: 'Ana Souza',
      email: 'ana@arvore.com.br',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
  await db
    .insert(organizations)
    .values({ id: 'org-arvore', name: 'Árvore', createdAt: new Date() })
  await db.insert(organizationMembers).values([
    {
      id: 'member-owner',
      orgId: 'org-arvore',
      userId: 'user-owner',
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: 'member-ana',
      orgId: 'org-arvore',
      userId: 'user-ana',
      role: 'member',
      createdAt: new Date(),
    },
  ])
})

async function runImport() {
  const warnings: Array<string> = []

  for await (const event of importNotionPlan(
    buildPlan(),
    { id: 'user-owner', orgAccess: 'editor', orgId: 'org-arvore' },
    messages,
  )) {
    expect(event.type).not.toBe('error')

    if (event.type === 'done') {
      warnings.push(...event.summary.warnings)
    }
  }

  return warnings
}

describe('native database materialization', () => {
  it('creates the typed schema with status groups and option colors', async () => {
    await runImport()

    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })

    expect(database?.kind).toBe('database')

    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, database?.id ?? ''))

    expect(properties.map((property) => property.type)).toEqual([
      'status',
      'person',
      'text',
    ])

    const status = properties[0]
    const options = parseOptions(status.options)

    expect(options.map((option) => option.group)).toEqual(['todo', 'done'])
    expect(options.map((option) => option.color)).toEqual(['gray', 'success'])
  })

  it('creates a table view and a board grouped by status', async () => {
    await runImport()

    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })
    const views = await db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, database?.id ?? ''))

    expect(views.map((view) => view.type).sort()).toEqual(['board', 'table'])

    const board = views.find((view) => view.type === 'board')
    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, database?.id ?? ''))

    expect(board?.config).toContain(properties[0].id)
  })

  it('maps row values to option ids, people and text snapshots', async () => {
    const warnings = await runImport()

    const row = await db.query.documents.findFirst({
      where: eq(documents.title, 'Write the report'),
    })
    const database = await db.query.documents.findFirst({
      where: eq(documents.title, 'Tasks'),
    })
    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, database?.id ?? ''))

    expect(row?.kind).toBe('row')

    const values = parseValues(row?.properties ?? null)

    expect(values[properties[0].id]).toBe('opt-open')
    expect(values[properties[1].id]).toEqual(['user-ana'])
    expect(values[properties[2].id]).toBe('TASK-12')

    expect(
      warnings.some((warning) => warning.includes('Someone Unknown')),
    ).toBe(true)
  })

  it('keeps the row body, the Notion timestamps and the icon', async () => {
    await runImport()

    const row = await db.query.documents.findFirst({
      where: eq(documents.title, 'Write the report'),
    })

    expect(row?.content).toContain('Body of the row page')
    expect(row?.icon).toBe('📝')
    expect(row?.createdAt.toISOString()).toBe('2025-04-01T10:00:00.000Z')
    expect(row?.updatedAt.toISOString()).toBe('2026-02-02T12:00:00.000Z')
  })
})

import { zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const uploads: Array<{ key: string; contentType: string; size: number }> = []

vi.mock('@/lib/storage', () => ({
  storage: {
    put: async (key: string, body: Buffer, contentType: string) => {
      uploads.push({ key, contentType, size: body.byteLength })
    },
    get: async () => null,
  },
}))

import type { PartialBlock } from '@blocknote/core'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documents,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseValues } from '@/lib/database/values'
import { parseContentBlocks } from '@/lib/markdown/convert'
import { parseCsv } from '@/lib/notion/csv'
import { buildNotionFixtureZip, fixtureTitles } from '@/lib/notion/fixture'
import { importNotionZip } from '@/lib/notion/import'
import type { ImportEvent, ImportSummary } from '@/lib/notion/import'
import { notionTitle } from '@/lib/notion/paths'
import { buildImportPlan } from '@/lib/notion/plan'
import { NotionImportError, readZipEntries } from '@/lib/notion/zip'

import { createTranslator } from 'next-intl'

import enUS from '../../../messages/en-US.json'
import { buildNotionImportMessages } from '@/lib/notion/messages'

const messages = buildNotionImportMessages(
  createTranslator({
    locale: 'en-US',
    messages: enUS,
    namespace: 'archiveImport',
  }) as (
    key: string,
    values?: Record<string, string | number | Date>,
  ) => string,
  enUS.document.untitled,
)

const owner = { id: 'user-owner', email: 'owner@example.com' }

async function runImport(
  data: Uint8Array,
  extra: { orgId?: string | null; orgAccess?: 'editor' | null } = {},
) {
  const events: Array<ImportEvent> = []
  let summary: ImportSummary | null = null
  let error: string | null = null

  for await (const event of importNotionZip(
    data,
    { ...owner, ...extra },
    messages,
  )) {
    events.push(event)

    if (event.type === 'done') {
      summary = event.summary
    }

    if (event.type === 'error') {
      error = event.error
    }
  }

  return { events, summary, error }
}

async function documentByTitle(title: string) {
  const row = await db.query.documents.findFirst({
    where: eq(documents.title, title),
  })

  if (!row) {
    throw new Error(`document not found: ${title}`)
  }

  return row
}

function blockTypes(blocks: Array<PartialBlock>): Array<string> {
  return blocks.flatMap((block) => [
    block.type as string,
    ...blockTypes((block.children ?? []) as Array<PartialBlock>),
  ])
}

function textOf(blocks: Array<PartialBlock>): string {
  return JSON.stringify(blocks)
}

beforeEach(async () => {
  await resetDatabase()
  uploads.length = 0

  await db.delete(documents)
  await db.delete(organizations)
  await db.delete(user)
  await db.insert(user).values({
    id: owner.id,
    name: 'Owner',
    email: owner.email,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('import of the Notion export', () => {
  it('builds the three-level hierarchy with titles without the hash', async () => {
    const { summary, error } = await runImport(buildNotionFixtureZip())

    expect(error).toBeNull()
    expect(summary?.pages).toBe(6)

    const plan = await documentByTitle(fixtureTitles.plan)
    const classPage = await documentByTitle(fixtureTitles.class)
    const student = await documentByTitle(fixtureTitles.student)

    expect(plan.parentId).toBeNull()
    expect(classPage.parentId).toBe(plan.id)
    expect(student.parentId).toBe(classPage.id)
  })

  it('writes the organization access across the whole imported tree', async () => {
    await db
      .insert(organizations)
      .values({ id: 'org-acme', name: 'Acme School', createdAt: new Date() })

    const { error } = await runImport(buildNotionFixtureZip(), {
      orgAccess: 'editor',
      orgId: 'org-acme',
    })

    expect(error).toBeNull()

    const rows = await db
      .select({
        orgAccess: documents.orgAccess,
        orgId: documents.orgId,
        title: documents.title,
      })
      .from(documents)

    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every((row) => row.orgAccess === 'editor')).toBe(true)
    expect(rows.every((row) => row.orgId === 'org-acme')).toBe(true)
  })

  it('with no destination chosen the imported tree stays private', async () => {
    await runImport(buildNotionFixtureZip())

    const rows = await db
      .select({ orgAccess: documents.orgAccess })
      .from(documents)

    expect(rows.every((row) => row.orgAccess === null)).toBe(true)
  })

  it('turns the Notion csv database into a database', async () => {
    await runImport(buildNotionFixtureZip())

    const plan = await documentByTitle(fixtureTitles.plan)
    const students = await documentByTitle(fixtureTitles.students)

    expect(students.parentId).toBe(plan.id)
    expect(students.kind).toBe('database')
    expect(parseContentBlocks(students.content)).toEqual([])

    const properties = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, students.id))

    expect(
      properties
        .sort((left, right) => left.position - right.position)
        .map((property) => [property.name, property.type]),
    ).toEqual([
      ['Books', 'number'],
      ['Comment', 'text'],
    ])

    const views = await db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, students.id))

    expect(views).toHaveLength(1)
    expect(views[0].type).toBe('table')
  })

  it('reuses the md page of the row instead of duplicating it', async () => {
    await runImport(buildNotionFixtureZip())

    const students = await documentByTitle(fixtureTitles.students)
    const ana = await documentByTitle(fixtureTitles.ana)

    expect(ana.parentId).toBe(students.id)
    expect(ana.kind).toBe('row')
    expect(textOf(parseContentBlocks(ana.content))).toContain('Reading record')

    const books = (
      await db
        .select()
        .from(databaseProperties)
        .where(eq(databaseProperties.databaseId, students.id))
    ).find((property) => property.name === 'Books')

    expect(parseValues(ana.properties)[books?.id ?? '']).toBe(12)
  })

  it('creates the row that only existed in the csv', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())

    const bruno = await documentByTitle('Bruno Lima')
    const students = await documentByTitle(fixtureTitles.students)

    expect(bruno.kind).toBe('row')
    expect(bruno.parentId).toBe(students.id)
    expect(summary?.pages).toBe(6)
  })

  it('uploads the image to the storage and rewrites the url in the block', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())

    expect(summary?.assets).toBe(2)
    expect(uploads.some((item) => item.contentType === 'image/png')).toBe(true)

    const classPage = await documentByTitle(fixtureTitles.class)
    const blocks = parseContentBlocks(classPage.content)
    const image = blocks.find((block) => block.type === 'image')

    expect(image).toBeDefined()
    expect(
      (image?.props as Record<string, unknown> | undefined)?.url,
    ).toMatch(/^\/api\/uploads\/u\/[\w-]+\.png$/)
  })

  it('rewrites the internal link to the route of the created document', async () => {
    await runImport(buildNotionFixtureZip())

    const plan = await documentByTitle(fixtureTitles.plan)
    const classPage = await documentByTitle(fixtureTitles.class)
    const blocks = parseContentBlocks(plan.content)

    expect(textOf(blocks)).toContain(`/doc/${classPage.id}`)
  })

  it('turns an attachment that is not an image into a link', async () => {
    await runImport(buildNotionFixtureZip())

    const classPage = await documentByTitle(fixtureTitles.class)
    const blocks = parseContentBlocks(classPage.content)
    const serialized = textOf(blocks)

    expect(serialized).toContain('.pdf')
    expect(blockTypes(blocks)).not.toContain('file')
  })

  it('turns aside and emoji quote into a callout block', async () => {
    await runImport(buildNotionFixtureZip())

    const plan = await documentByTitle(fixtureTitles.plan)
    const classPage = await documentByTitle(fixtureTitles.class)

    expect(blockTypes(parseContentBlocks(plan.content))).toContain('callout')

    const classBlocks = parseContentBlocks(classPage.content)

    expect(blockTypes(classBlocks)).toContain('callout')
    expect(textOf(classBlocks)).not.toContain('💡')
  })

  it('does not repeat the document title as the first block', async () => {
    await runImport(buildNotionFixtureZip())

    const plan = await documentByTitle(fixtureTitles.plan)
    const blocks = parseContentBlocks(plan.content)
    const first = blocks[0]

    expect(first.type).not.toBe('heading')
    expect(textOf([first])).not.toContain(fixtureTitles.plan)
  })

  it('warns that the toggle list lost its open and close behavior', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())

    expect(
      summary?.warnings.some((warning) => warning.includes('toggle list')),
    ).toBe(true)
  })

  it('returns the root document to open after the import', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())
    const plan = await documentByTitle(fixtureTitles.plan)

    expect(summary?.rootId).toBe(plan.id)
    expect(summary?.rootTitle).toBe(fixtureTitles.plan)
  })

  it('rejects a zip without a single page', async () => {
    const empty = zipSync({ 'read-me.txt': new TextEncoder().encode('hi') })
    const { error, summary } = await runImport(empty)

    expect(summary).toBeNull()
    expect(error).toContain("didn't find any pages")
  })
})

describe('zip safety', () => {
  it('rejects a path that climbs out of the directory', () => {
    const data = zipSync({
      'page.md': new TextEncoder().encode('# ok'),
      '../outside.md': new TextEncoder().encode('# outside'),
    })

    expect(() => readZipEntries(data, messages)).toThrow(NotionImportError)
  })

  it('rejects an absolute path', () => {
    const data = zipSync({
      '/etc/passwd': new TextEncoder().encode('root'),
    })

    expect(() => readZipEntries(data, messages)).toThrow(NotionImportError)
  })

  it('rejects when the declared uncompressed size goes over the limit', () => {
    const data = zipSync({
      'bomb.md': new Uint8Array(64 * 1024),
    })

    expect(() => readZipEntries(data, messages, { maxBytes: 1024 })).toThrow(
      NotionImportError,
    )
  })

  it('rejects when it goes over the number of files', () => {
    const files: Record<string, Uint8Array> = {}

    for (let index = 0; index < 12; index += 1) {
      files[`p${index}.md`] = new TextEncoder().encode('# x')
    }

    expect(() => readZipEntries(data(files), messages, { maxEntries: 10 })).toThrow(
      NotionImportError,
    )
  })

  it('ignores operating system junk', () => {
    const entries = readZipEntries(
      data({
        '__MACOSX/._page.md': new TextEncoder().encode('junk'),
        'page.md': new TextEncoder().encode('# ok'),
        '.DS_Store': new TextEncoder().encode('junk'),
      }),
      messages,
    )

    expect(entries.map((entry) => entry.path)).toEqual(['page.md'])
  })

  it('blocks the whole import when the zip has an unsafe path', async () => {
    const { error } = await runImport(
      zipSync({
        'ok.md': new TextEncoder().encode('# ok'),
        '../escaped.md': new TextEncoder().encode('# escaped'),
      }),
    )

    expect(error).toContain('invalid paths')
  })
})

function data(files: Record<string, Uint8Array>) {
  return zipSync(files)
}

describe('Notion page name', () => {
  it('strips the 32-character hash from the title', () => {
    expect(
      notionTitle('Lesson plan 1111111111111111111111111111aaaa.md', 'Untitled'),
    ).toBe('Lesson plan')
    expect(
      notionTitle('Base 4444444444444444444444444444dddd.csv', 'Untitled'),
    ).toBe('Base')
    expect(notionTitle('No hash.md', 'Untitled')).toBe('No hash')
  })
})

describe('Notion csv', () => {
  it('reads a cell with a comma and quotes', () => {
    const rows = parseCsv('a,b\n"one, two",three\n')

    expect(rows).toEqual([
      ['a', 'b'],
      ['one, two', 'three'],
    ])
  })
})

describe('import plan', () => {
  it('keeps a folder without md as a grouping page', () => {
    const plan = buildImportPlan(
      readZipEntries(
        data({
          'Notebook/Lesson 1111111111111111111111111111aaaa.md':
            new TextEncoder().encode('# Lesson'),
        }),
        messages,
      ),
      messages.untitled,
    )

    expect(plan.pages.map((page) => page.title)).toEqual(['Lesson'])
  })

  it('does not flatten the root folder when it is a Notion page', () => {
    const plan = buildImportPlan(
      readZipEntries(
        data({
          'Notebook 1111111111111111111111111111aaaa/Lesson 2222222222222222222222222222bbbb.md':
            new TextEncoder().encode('# Lesson'),
        }),
        messages,
      ),
      messages.untitled,
    )

    expect(plan.pages.map((page) => page.title)).toEqual(['Notebook', 'Lesson'])
    expect(plan.pages[1].parentKey).toBe(plan.pages[0].key)
  })
})

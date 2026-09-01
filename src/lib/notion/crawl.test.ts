import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const uploads: Array<{ key: string; contentType: string; size: number }> = []

vi.mock('@/lib/storage', () => ({
  storage: {
    put: async (key: string, bodyBytes: Buffer, contentType: string) => {
      uploads.push({ contentType, key, size: bodyBytes.byteLength })
    },
    get: async () => null,
  },
}))

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { comments, documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseContentBlocks } from '@/lib/markdown/convert'
import type {
  NotionBlock,
  NotionClient,
  NotionDatabaseObject,
  NotionPageObject,
} from '@/lib/notion/api'
import { crawlNotionPage } from '@/lib/notion/crawl'
import type { CrawlMessages } from '@/lib/notion/crawl'
import { importNotionPlan } from '@/lib/notion/import'
import type { NotionPlan } from '@/lib/notion/plan'

const rootId = '11111111-1111-1111-1111-111111111111'
const childId = '22222222-2222-2222-2222-222222222222'
const databaseId = '33333333-3333-3333-3333-333333333333'
const imageUrl = 'https://prod-files.s3.amazonaws.com/photo.png?X-Amz-Expires=1'

const messages: CrawlMessages = {
  assetFailed: (name) => `failed ${name}`,
  assetTooLarge: (name, limit) => `too large ${name} ${limit}`,
  commentsUnavailable: 'no permission to read comments',
  crawlTruncated: (max) => `stopped at ${max}`,
  pageFailed: (title) => `page ${title}`,
  untitled: 'Untitled',
}

const importMessages = {
  ...messages,
  assetTooLarge: (name: string, limit: string) => `${name} ${limit}`,
  commentsFailed: 'comments failed',
  commentsImported: (count: number) => `${count} comments`,
  csvColumn: 'Column',
  csvDatabases: (count: number) => `${count} databases`,
  unresolvedPeople: (count: number, names: string) =>
    `${count} without an owner: ${names}`,
  csvView: 'Table',
  missingLinks: (count: number) => `${count} links`,
  noPages: 'no pages',
  togglesDegraded: (count: number) => `${count} toggles`,
  tooManyEntries: (max: number) => `${max} items`,
  unreadableZip: 'bad zip',
  unsafePaths: 'bad path',
  unzippedTooLarge: (limit: string) => `over ${limit}`,
}

const notionAuthors: Record<string, { id: string; name?: string; person?: { email?: string } }> = {
  'user-ana': {
    id: 'user-ana',
    name: 'Ana Souza',
    person: { email: 'ana@arvore.com.br' },
  },
  'user-outside': { id: 'user-outside', name: 'Someone from Outside' },
}

const notionComments = [
  {
    created_by: { id: 'user-ana' },
    created_time: '2026-08-30T12:00:00.000Z',
    discussion_id: 'disc-1',
    id: 'c-1',
    rich_text: [{ plain_text: 'This one here is out of date' }],
  },
  {
    created_by: { id: 'user-outside' },
    created_time: '2026-08-30T12:05:00.000Z',
    discussion_id: 'disc-1',
    id: 'c-2',
    rich_text: [{ plain_text: 'Agreed, I will review it' }],
  },
  {
    created_by: { id: 'user-ana' },
    created_time: '2026-08-30T13:00:00.000Z',
    discussion_id: 'disc-2',
    id: 'c-3',
    rich_text: [{ plain_text: 'Another thread' }],
  },
]

function titleProperty(text: string) {
  return { Name: { type: 'title', title: [{ plain_text: text }] } }
}

function richText(text: string, extra: Record<string, unknown> = {}) {
  return [{ annotations: {}, plain_text: text, ...extra }]
}

const pages: Record<string, NotionPageObject> = {
  [childId]: { id: childId, properties: titleProperty('Class A') },
  [rootId]: { id: rootId, properties: titleProperty('Reading plan') },
}

const blocksById: Record<string, Array<NotionBlock>> = {
  [childId]: [
    {
      id: 'b-child-text',
      paragraph: { rich_text: richText('Class content') },
      type: 'paragraph',
    },
  ],
  [rootId]: [
    {
      heading_1: { rich_text: richText('Goals') },
      id: 'b-heading',
      type: 'heading_1',
    },
    {
      bulleted_list_item: { rich_text: richText('Read every day') },
      id: 'b-item',
      type: 'bulleted_list_item',
    },
    {
      id: 'b-link',
      paragraph: {
        rich_text: richText('see the class', {
          href: `https://www.notion.so/Class-${childId.replace(/-/g, '')}`,
        }),
      },
      type: 'paragraph',
    },
    {
      id: 'b-image',
      image: { file: { url: imageUrl }, caption: [] },
      type: 'image',
    },
    { id: 'b-table', table: {}, type: 'table', has_children: true },
    { child_page: { title: 'Class A' }, id: childId, type: 'child_page' },
    {
      child_database: { title: 'Students' },
      id: databaseId,
      type: 'child_database',
    },
  ],
  'b-table': [
    {
      id: 'b-row-1',
      table_row: { cells: [richText('Student'), richText('Grade')] },
      type: 'table_row',
    },
    {
      id: 'b-row-2',
      table_row: { cells: [richText('Ana'), richText('9')] },
      type: 'table_row',
    },
  ],
}

const database: NotionDatabaseObject = {
  id: databaseId,
  properties: {
    Name: { name: 'Name', type: 'title' },
    Class: { name: 'Class', type: 'rich_text' },
  },
  title: [{ plain_text: 'Students' }],
}

const rows: Array<NotionPageObject> = [
  {
    id: 'row-1',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Ana Souza' }] },
      Class: { type: 'rich_text', rich_text: [{ plain_text: '5th grade' }] },
    },
  },
]

const downloads: Array<string> = []

function fakeClient(
  options: { comments?: boolean; commentsFail?: boolean } = {},
): NotionClient {
  return {
    comments: async function* (id: string) {
      if (options.commentsFail) {
        throw new Error('403')
      }

      if (!options.comments || id !== rootId) {
        return
      }

      for (const comment of notionComments) {
        yield comment
      }
    },
    user: async (id: string) => {
      const author = notionAuthors[id]

      if (!author) {
        throw new Error('no user')
      }

      return author
    },
    children: async function* (id: string) {
      for (const block of blocksById[id] ?? []) {
        yield block
      }
    },
    database: async () => database,
    download: async (url: string) => {
      downloads.push(url)

      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' }
    },
    page: async (id: string) => {
      const page = pages[id]

      if (!page) {
        throw new Error(`no page ${id}`)
      }

      return page
    },
    rows: async function* () {
      for (const row of rows) {
        yield row
      }
    },
  }
}

async function crawl(): Promise<NotionPlan> {
  let plan: NotionPlan | null = null

  for await (const event of crawlNotionPage(fakeClient(), rootId, messages)) {
    if (event.type === 'plan') {
      plan = event.plan
    }
  }

  if (!plan) {
    throw new Error('no plan')
  }

  return plan
}

async function crawlWithComments(options: { commentsFail?: boolean } = {}) {
  for await (const event of crawlNotionPage(
    fakeClient({ comments: true, commentsFail: options.commentsFail }),
    rootId,
    messages,
    undefined,
    { comments: true },
  )) {
    if (event.type === 'plan') {
      return event
    }
  }

  throw new Error('no plan')
}

beforeEach(async () => {
  await resetDatabase()
  uploads.length = 0
  downloads.length = 0

  await db.delete(comments)
  await db.delete(documents)
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
})

describe('crawl of the Notion page', () => {
  it('walks down from the page into the subpages and the database', async () => {
    const plan = await crawl()

    expect(plan.pages.map((page) => page.title)).toEqual([
      'Reading plan',
      'Class A',
      'Students',
    ])

    const child = plan.pages.find((page) => page.title === 'Class A')
    const base = plan.pages.find((page) => page.title === 'Students')

    expect(child?.parentKey).toBe(`${rootId}.md`)
    expect(base?.parentKey).toBe(`${rootId}.md`)
    expect(base?.kind).toBe('csv')
  })

  it('reports each page read while walking', async () => {
    const seen: Array<string> = []

    for await (const event of crawlNotionPage(fakeClient(), rootId, messages)) {
      if (event.type === 'page') {
        seen.push(event.title)
      }
    }

    expect(seen).toEqual(['Reading plan', 'Class A', 'Students'])
  })

  it('writes the markdown with heading, list and table', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(markdown).toContain('# Goals')
    expect(markdown).toContain('- Read every day')
    expect(markdown).toContain('| Student | Grade |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| Ana | 9 |')
  })

  it('points the internal link at the file of the subpage', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(markdown).toContain(`[see the class](${childId}.md)`)
  })

  it('downloads the image and keeps the local path in the markdown', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(downloads).toEqual([imageUrl])
    expect(plan.assets).toHaveLength(1)
    expect(plan.assets[0].isImage).toBe(true)
    expect(markdown).toContain(`![](${plan.assets[0].path})`)
  })

  it('becomes a csv with the title in the first column', async () => {
    const plan = await crawl()
    const csv = plan.csvByPath.get(`${databaseId}.csv`) ?? ''

    expect(csv.split('\n')[0]).toBe('Name,Class')
    expect(csv).toContain('Ana Souza,5th grade')
  })
})

describe('importing what the crawl assembled', () => {
  it('creates the documents with hierarchy, content and destination', async () => {
    const plan = await crawl()

    for await (const event of importNotionPlan(
      plan,
      { id: 'user-owner', orgAccess: null, orgId: null },
      importMessages,
    )) {
      expect(event.type).not.toBe('error')
    }

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })
    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Class A'),
    })
    const base = await db.query.documents.findFirst({
      where: eq(documents.title, 'Students'),
    })

    expect(root?.parentId).toBeNull()
    expect(child?.parentId).toBe(root?.id)
    expect(base?.kind).toBe('database')
    expect(uploads).toHaveLength(1)

    const blocks = parseContentBlocks(root?.content ?? null)
    const types = blocks.map((block) => block.type)

    expect(types).toContain('heading')
    expect(types).toContain('bulletListItem')
    expect(JSON.stringify(blocks)).toContain(`/doc/${child?.id}`)
  })
})

describe('open Notion comments', () => {
  it('does not ask for comments when the box is left unchecked', async () => {
    const event = await (async () => {
      for await (const item of crawlNotionPage(
        fakeClient({ comments: true }),
        rootId,
        messages,
      )) {
        if (item.type === 'plan') {
          return item
        }
      }

      throw new Error('no plan')
    })()

    expect(event.comments.size).toBe(0)
  })

  it('gathers the open threads of the page', async () => {
    const event = await crawlWithComments()
    const threads = event.comments.get(`${rootId}.md`) ?? []

    expect(threads).toHaveLength(3)
    expect(threads[0].discussionId).toBe('disc-1')
    expect(threads[0].authorEmail).toBe('ana@arvore.com.br')
    expect(threads[1].authorEmail).toBeNull()
    expect(threads[1].authorName).toBe('Someone from Outside')
  })

  it('warns when the connection cannot read comments', async () => {
    const event = await crawlWithComments({ commentsFail: true })

    expect(event.comments.size).toBe(0)
    expect(event.warnings).toContain('no permission to read comments')
  })

  it('creates the thread on the document, with a reply and the author matched by email', async () => {
    const event = await crawlWithComments()

    for await (const step of importNotionPlan(
      event.plan,
      { id: 'user-owner', orgAccess: null, orgId: null },
      importMessages,
      undefined,
      event.comments,
    )) {
      expect(step.type).not.toBe('error')
    }

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Reading plan'),
    })

    const rows = await db
      .select({
        id: comments.id,
        authorId: comments.authorId,
        body: comments.body,
        documentId: comments.documentId,
        parentId: comments.parentId,
        blockId: comments.blockId,
        resolvedAt: comments.resolvedAt,
      })
      .from(comments)

    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.documentId === root?.id)).toBe(true)
    expect(rows.every((row) => row.blockId === null)).toBe(true)
    expect(rows.every((row) => row.resolvedAt === null)).toBe(true)

    const first = rows.find((row) => row.body.includes('out of date'))
    const reply = rows.find((row) => row.body.includes('will review'))

    expect(first?.authorId).toBe('user-ana')
    expect(first?.parentId).toBeNull()
    expect(reply?.parentId).toBe(first?.id)
    expect(reply?.authorId).toBeNull()
    expect(reply?.body).toBe('Someone from Outside: Agreed, I will review it')
  })
})

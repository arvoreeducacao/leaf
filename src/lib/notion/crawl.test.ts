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
import { documents, user } from '@/db/schema'
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
const imageUrl = 'https://prod-files.s3.amazonaws.com/foto.png?X-Amz-Expires=1'

const messages: CrawlMessages = {
  assetFailed: (name) => `falhou ${name}`,
  assetTooLarge: (name, limit) => `grande ${name} ${limit}`,
  crawlTruncated: (max) => `parou em ${max}`,
  pageFailed: (title) => `pagina ${title}`,
  untitled: 'Sem título',
}

function titleProperty(text: string) {
  return { Name: { type: 'title', title: [{ plain_text: text }] } }
}

function richText(text: string, extra: Record<string, unknown> = {}) {
  return [{ annotations: {}, plain_text: text, ...extra }]
}

const pages: Record<string, NotionPageObject> = {
  [childId]: { id: childId, properties: titleProperty('Turma A') },
  [rootId]: { id: rootId, properties: titleProperty('Plano de leitura') },
}

const blocksById: Record<string, Array<NotionBlock>> = {
  [childId]: [
    {
      id: 'b-child-text',
      paragraph: { rich_text: richText('Conteúdo da turma') },
      type: 'paragraph',
    },
  ],
  [rootId]: [
    {
      heading_1: { rich_text: richText('Objetivos') },
      id: 'b-heading',
      type: 'heading_1',
    },
    {
      bulleted_list_item: { rich_text: richText('Ler todo dia') },
      id: 'b-item',
      type: 'bulleted_list_item',
    },
    {
      id: 'b-link',
      paragraph: {
        rich_text: richText('ver a turma', {
          href: `https://www.notion.so/Turma-${childId.replace(/-/g, '')}`,
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
    { child_page: { title: 'Turma A' }, id: childId, type: 'child_page' },
    {
      child_database: { title: 'Alunos' },
      id: databaseId,
      type: 'child_database',
    },
  ],
  'b-table': [
    {
      id: 'b-row-1',
      table_row: { cells: [richText('Aluno'), richText('Nota')] },
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
    Nome: { name: 'Nome', type: 'title' },
    Turma: { name: 'Turma', type: 'rich_text' },
  },
  title: [{ plain_text: 'Alunos' }],
}

const rows: Array<NotionPageObject> = [
  {
    id: 'row-1',
    properties: {
      Nome: { type: 'title', title: [{ plain_text: 'Ana Souza' }] },
      Turma: { type: 'rich_text', rich_text: [{ plain_text: '5º ano' }] },
    },
  },
]

const downloads: Array<string> = []

function fakeClient(): NotionClient {
  return {
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
        throw new Error(`sem página ${id}`)
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
    throw new Error('sem plano')
  }

  return plan
}

beforeEach(async () => {
  await resetDatabase()
  uploads.length = 0
  downloads.length = 0

  await db.delete(documents)
  await db.delete(user)
  await db.insert(user).values({
    id: 'user-owner',
    name: 'Dono',
    email: 'dono@arvore.com.br',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('varredura da página do Notion', () => {
  it('desce da página para as subpáginas e para a database', async () => {
    const plan = await crawl()

    expect(plan.pages.map((page) => page.title)).toEqual([
      'Plano de leitura',
      'Turma A',
      'Alunos',
    ])

    const child = plan.pages.find((page) => page.title === 'Turma A')
    const base = plan.pages.find((page) => page.title === 'Alunos')

    expect(child?.parentKey).toBe(`${rootId}.md`)
    expect(base?.parentKey).toBe(`${rootId}.md`)
    expect(base?.kind).toBe('csv')
  })

  it('conta a página lida enquanto anda', async () => {
    const seen: Array<string> = []

    for await (const event of crawlNotionPage(fakeClient(), rootId, messages)) {
      if (event.type === 'page') {
        seen.push(event.title)
      }
    }

    expect(seen).toEqual(['Plano de leitura', 'Turma A', 'Alunos'])
  })

  it('escreve o markdown com título, lista e tabela', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(markdown).toContain('# Objetivos')
    expect(markdown).toContain('- Ler todo dia')
    expect(markdown).toContain('| Aluno | Nota |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| Ana | 9 |')
  })

  it('aponta o link interno para o arquivo da subpágina', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(markdown).toContain(`[ver a turma](${childId}.md)`)
  })

  it('baixa a imagem e guarda o caminho local no markdown', async () => {
    const plan = await crawl()
    const markdown = plan.markdownByPath.get(`${rootId}.md`) ?? ''

    expect(downloads).toEqual([imageUrl])
    expect(plan.assets).toHaveLength(1)
    expect(plan.assets[0].isImage).toBe(true)
    expect(markdown).toContain(`![](${plan.assets[0].path})`)
  })

  it('vira csv com o título na primeira coluna', async () => {
    const plan = await crawl()
    const csv = plan.csvByPath.get(`${databaseId}.csv`) ?? ''

    expect(csv.split('\n')[0]).toBe('Nome,Turma')
    expect(csv).toContain('Ana Souza,5º ano')
  })
})

describe('importar o que a varredura montou', () => {
  it('cria os documentos com hierarquia, conteúdo e destino', async () => {
    const plan = await crawl()

    for await (const event of importNotionPlan(
      plan,
      { id: 'user-owner', orgAccess: null, orgId: null },
      {
        ...messages,
        csvColumn: 'Coluna',
        csvDatabases: (count) => `${count} bases`,
        csvView: 'Tabela',
        missingLinks: (count) => `${count} links`,
        noPages: 'sem páginas',
        pageFailed: (title) => `falhou ${title}`,
        togglesDegraded: (count) => `${count} toggles`,
        tooManyEntries: (max) => `${max} itens`,
        unreadableZip: 'zip ruim',
        unsafePaths: 'caminho ruim',
        unzippedTooLarge: (limit) => `passa de ${limit}`,
        assetTooLarge: (name, limit) => `${name} ${limit}`,
      },
    )) {
      expect(event.type).not.toBe('error')
    }

    const root = await db.query.documents.findFirst({
      where: eq(documents.title, 'Plano de leitura'),
    })
    const child = await db.query.documents.findFirst({
      where: eq(documents.title, 'Turma A'),
    })
    const base = await db.query.documents.findFirst({
      where: eq(documents.title, 'Alunos'),
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

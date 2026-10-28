import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { documentLinkScans, documentLinks, documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  LINK_CONTEXT_MAX,
  indexDocumentLinks,
  linksInContent,
  reconcileDocumentLinks,
} from '@/lib/document-link-index'

const owner = { id: 'user-owner', email: 'owner@example.com' }

function text(value: string) {
  return { type: 'text', text: value, styles: {} }
}

function link(id: string, title: string) {
  return { type: 'link', href: `/doc/${id}`, content: [text(title)] }
}

function paragraph(...content: Array<unknown>) {
  return { type: 'paragraph', props: {}, content, children: [] }
}

function body(...blocks: Array<unknown>) {
  return JSON.stringify(blocks)
}

async function linksFrom(sourceId: string) {
  const rows = await db
    .select({ targetId: documentLinks.targetId, context: documentLinks.context })
    .from(documentLinks)
    .where(eq(documentLinks.sourceId, sourceId))

  return rows.sort((a, b) => a.targetId.localeCompare(b.targetId))
}

async function insertDocument(id: string, content: string | null, updatedAt = new Date()) {
  await db.insert(documents).values({
    id,
    ownerId: owner.id,
    title: id,
    content,
    updatedAt,
  })
}

describe('linksInContent', () => {
  it('reads each linked page once, with the sentence around the link', () => {
    const content = body(
      paragraph(text('Antes de subir, confira o '), link('deploy', 'Guia de deploy'), text('.')),
      paragraph(text('Veja também o '), link('deploy', 'guia'), text(' de novo.')),
    )

    expect(linksInContent(content, 'source')).toEqual([
      { targetId: 'deploy', context: 'Antes de subir, confira o Guia de deploy.' },
    ])
  })

  it('ignores a link of the page to itself', () => {
    const content = body(paragraph(text('Esta página: '), link('source', 'eu')))

    expect(linksInContent(content, 'source')).toEqual([])
  })

  it('reads links inside nested blocks and table cells', () => {
    const content = body({
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        rows: [{ cells: [[text('Plantão')], [link('plantao', 'Escala'), text(' da semana')]] }],
      },
      children: [paragraph(text('Filho com '), link('filho', 'link'))],
    })

    expect(linksInContent(content, 'source')).toEqual([
      { targetId: 'plantao', context: 'Plantão Escala da semana' },
      { targetId: 'filho', context: 'Filho com link' },
    ])
  })

  it('cuts a long paragraph around the link', () => {
    const before = 'palavra '.repeat(60)
    const after = ' termo'.repeat(60)
    const content = body(paragraph(text(before), link('alvo', 'Página alvo'), text(after)))

    const [found] = linksInContent(content, 'source')

    expect(found?.context).toContain('Página alvo')
    expect(found?.context.startsWith('…')).toBe(true)
    expect(found?.context.endsWith('…')).toBe(true)
    expect(Array.from(found?.context ?? '').length).toBeLessThanOrEqual(LINK_CONTEXT_MAX + 2)
  })

  it('keeps a link that lives outside the text with an empty context', () => {
    const content = body({ type: 'pageEmbed', props: { href: '/doc/embutida' }, children: [] })

    expect(linksInContent(content, 'source')).toEqual([{ targetId: 'embutida', context: '' }])
  })

  it('returns nothing for empty or broken content', () => {
    expect(linksInContent(null, 'source')).toEqual([])
    expect(linksInContent('{"href":"/doc/alvo"', 'source')).toEqual([
      { targetId: 'alvo', context: '' },
    ])
  })
})

describe('document link index', () => {
  beforeEach(async () => {
    await resetDatabase()

    await db.insert(user).values({
      id: owner.id,
      name: owner.email,
      email: owner.email,
      emailVerified: true,
    })
  })

  it('stores the links to pages that exist and marks the scan', async () => {
    const updatedAt = new Date('2026-10-01T12:00:00.000Z')

    await insertDocument('alvo', body(paragraph(text('Sou o alvo'))))
    await insertDocument(
      'origem',
      body(paragraph(text('Leia o '), link('alvo', 'alvo'), text(' e o '), link('sumida', 'sumida'))),
      updatedAt,
    )

    await indexDocumentLinks('origem')

    expect(await linksFrom('origem')).toEqual([
      { targetId: 'alvo', context: 'Leia o alvo e o sumida' },
    ])

    const [scan] = await db
      .select()
      .from(documentLinkScans)
      .where(eq(documentLinkScans.documentId, 'origem'))

    expect(scan?.scannedAt.getTime()).toBe(updatedAt.getTime())
  })

  it('replaces the links when the page changes', async () => {
    await insertDocument('a', null)
    await insertDocument('b', null)
    await insertDocument('origem', body(paragraph(link('a', 'A'))))

    await indexDocumentLinks('origem')

    await db
      .update(documents)
      .set({ content: body(paragraph(link('b', 'B'))), updatedAt: new Date() })
      .where(eq(documents.id, 'origem'))

    await indexDocumentLinks('origem')

    expect((await linksFrom('origem')).map((row) => row.targetId)).toEqual(['b'])
  })

  it('reconciles pages never scanned or changed since the last scan', async () => {
    await insertDocument('alvo', null)
    await insertDocument('origem', body(paragraph(link('alvo', 'alvo'))))

    expect(await reconcileDocumentLinks(10)).toBe(2)
    expect(await reconcileDocumentLinks(10)).toBe(0)

    await db
      .update(documents)
      .set({ updatedAt: new Date(Date.now() + 1000) })
      .where(eq(documents.id, 'origem'))

    expect(await reconcileDocumentLinks(10)).toBe(1)
    expect((await linksFrom('origem')).map((row) => row.targetId)).toEqual(['alvo'])
  })

  it('respects the budget', async () => {
    await insertDocument('a', null)
    await insertDocument('b', null)
    await insertDocument('c', null)

    expect(await reconcileDocumentLinks(2)).toBe(2)
    expect(await reconcileDocumentLinks(2)).toBe(1)
  })

  it('drops the links when the target page is removed for good', async () => {
    await insertDocument('alvo', null)
    await insertDocument('origem', body(paragraph(link('alvo', 'alvo'))))

    await indexDocumentLinks('origem')
    await db.delete(documents).where(eq(documents.id, 'alvo'))

    expect(await linksFrom('origem')).toEqual([])
  })
})

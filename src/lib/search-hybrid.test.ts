import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const embedding = vi.hoisted(() => ({
  broken: false,
  topics: [
    ['férias', 'descanso', 'folga', 'recesso'],
    ['reunião', 'agenda', 'ata'],
    ['onboarding', 'cultura', 'manual'],
    ['deploy', 'release'],
  ],
}))

vi.mock('@/lib/embedding-client', async () => {
  const { normalizeVector } = await import('@/lib/embedding-vector')

  return {
    embedTexts: async (_config: unknown, values: ReadonlyArray<string>) => {
      if (embedding.broken) {
        throw new Error('the embedding provider is down')
      }

      return values.map((value) =>
        normalizeVector(
          embedding.topics.map((words) =>
            words.some((word) => value.toLowerCase().includes(word)) ? 1 : 0,
          ),
        ),
      )
    },
  }
})

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { askPassagesHybrid, searchDocumentsHybrid } from '@/lib/search-hybrid'
import {
  reconcileSearchIndex,
  scheduleSearchIndexReconcile,
} from '@/lib/search-index'
import { clearSemanticCache, reconcileSemanticIndex } from '@/lib/semantic-index'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }
const guest = { id: 'user-guest', email: 'guest@arvore.com.br' }
const member = { id: 'user-member', email: 'member@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'outside@arvore.com.br' }

const org = 'org-arvore'

function viewerOf(person: { id: string; email: string }) {
  return { userId: person.id, email: person.email }
}

function paragraphs(...texts: Array<string>) {
  return JSON.stringify(
    texts.map((text, index) => ({
      id: `b${index}`,
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  )
}

const filler = Array.from({ length: 160 }, () => 'palavra').join(' ')

async function indexedDocumentCount(
  table: 'documents_fts' | 'document_chunks',
) {
  const result = (await db.execute(
    table === 'documents_fts'
      ? sql`select count(distinct document_id) as total from documents_fts`
      : sql`select count(distinct document_id) as total from document_chunks`,
  )) as unknown as [Array<{ total: number | string }>, unknown]

  return Number(result[0][0].total)
}

async function seed() {
  const now = new Date()

  await db.insert(user).values(
    [owner, guest, member, stranger].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db
    .insert(organizations)
    .values({ id: org, name: 'Árvore School', createdAt: now })

  await db.insert(organizationMembers).values([
    {
      id: 'm-owner',
      orgId: org,
      userId: owner.id,
      role: 'owner',
      createdAt: now,
    },
    {
      id: 'm-member',
      orgId: org,
      userId: member.id,
      role: 'member',
      createdAt: now,
    },
  ])

  await db.insert(documents).values([
    {
      id: 'doc-private',
      ownerId: owner.id,
      orgId: org,
      title: 'Política de férias',
      content: paragraphs(
        'Cada pessoa tem trinta dias de férias por ano e o pedido vai para a liderança.',
      ),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-shared',
      ownerId: owner.id,
      orgId: org,
      title: 'Ata da reunião',
      content: paragraphs('A agenda combinada foi a da reunião de terça.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org',
      ownerId: owner.id,
      orgId: org,
      orgAccess: 'viewer',
      title: 'Manual do time',
      content: paragraphs('Rotinas de onboarding e cultura da casa.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-plain',
      ownerId: owner.id,
      orgId: org,
      title: 'Guia de estilo',
      content: paragraphs('Como escrever títulos e parágrafos no editor.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-long',
      ownerId: owner.id,
      orgId: org,
      title: 'Runbook do time',
      content: paragraphs(
        `Introdução do runbook ${filler}`,
        `Meio do runbook ${filler}`,
        `Ao fim, o deploy do serviço ${filler}`,
      ),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-trashed',
      ownerId: owner.id,
      title: 'Rascunho antigo',
      content: paragraphs('Texto sobre descanso e folga que foi descartado.'),
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
  ])

  await db.insert(documentShares).values({
    id: 'share-1',
    documentId: 'doc-shared',
    granteeEmail: guest.email,
    role: 'viewer',
    createdAt: now,
  })
}

beforeEach(async () => {
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.LEAF_EMBEDDING_DIMENSIONS = String(embedding.topics.length)
  embedding.broken = false
  clearSemanticCache()
  await resetDatabase()
  await seed()
  await reconcileSearchIndex()
  await reconcileSemanticIndex(20)
  clearSemanticCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('searchDocumentsHybrid', () => {
  it('finds by meaning what the full-text search cannot see', async () => {
    const hits = await searchDocumentsHybrid(viewerOf(owner), 'recesso')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
    expect(hits[0].segments.some((segment) => segment.highlight)).toBe(false)
    expect(hits[0].segments[0].text.startsWith('Cada pessoa')).toBe(true)
  })

  it('marks the word of the query inside a chunk found by meaning', async () => {
    const [hit] = await searchDocumentsHybrid(
      viewerOf(owner),
      'recesso férias',
    )

    expect(hit.id).toBe('doc-private')
    expect(
      hit.segments
        .filter((segment) => segment.highlight)
        .map((segment) => segment.text),
    ).toEqual(['férias'])
  })

  it('keeps the highlighted excerpt of the full-text search', async () => {
    const [hit] = await searchDocumentsHybrid(viewerOf(owner), 'férias')

    expect(hit.id).toBe('doc-private')
    expect(
      hit.segments
        .filter((segment) => segment.highlight)
        .map((segment) => segment.text),
    ).toEqual(['férias'])
  })

  it('puts first what both rankings agree on', async () => {
    const hits = await searchDocumentsHybrid(viewerOf(owner), 'cultura')

    expect(hits[0].id).toBe('doc-org')
  })

  it('never returns a document the person cannot open', async () => {
    expect(await searchDocumentsHybrid(viewerOf(stranger), 'recesso')).toEqual(
      [],
    )
    expect(await searchDocumentsHybrid(viewerOf(stranger), 'férias')).toEqual([])
    expect(await searchDocumentsHybrid(viewerOf(member), 'recesso')).toEqual([])
    expect(
      (await searchDocumentsHybrid(viewerOf(guest), 'ata da reunião')).map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-shared'])
  })

  it('keeps the trash out of the palette', async () => {
    const hits = await searchDocumentsHybrid(viewerOf(owner), 'folga')

    expect(hits.map((hit) => hit.id)).not.toContain('doc-trashed')
  })

  it('falls back to the full-text search when embeddings are off', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    expect(
      (await searchDocumentsHybrid(viewerOf(owner), 'férias')).map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-private'])
    expect(await searchDocumentsHybrid(viewerOf(owner), 'recesso')).toEqual([])
  })

  it('keeps working when the embedding provider is down', async () => {
    embedding.broken = true

    expect(
      (await searchDocumentsHybrid(viewerOf(owner), 'férias')).map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-private'])
    expect(await searchDocumentsHybrid(viewerOf(owner), 'recesso')).toEqual([])
  })

  it('respects the limit it was given', async () => {
    expect(
      await searchDocumentsHybrid(viewerOf(owner), 'palavra runbook', 1),
    ).toHaveLength(1)
  })
})

describe('askPassagesHybrid', () => {
  it('hands the AI the chunk that matched, not the whole document', async () => {
    const passages = await askPassagesHybrid(
      viewerOf(owner),
      'onde fica o deploy do serviço?',
    )

    const runbook = passages.find((passage) => passage.id === 'doc-long')

    expect(runbook).toBeDefined()
    expect(runbook?.body).toContain('deploy')
    expect(runbook?.body).not.toContain('Introdução')
  })

  it('fills the rest of the answer with what only the full-text search found', async () => {
    const passages = await askPassagesHybrid(
      viewerOf(owner),
      'agenda e parágrafos do editor',
    )

    expect(passages.map((passage) => passage.id)).toContain('doc-plain')
    expect(passages.map((passage) => passage.id)).toContain('doc-shared')
  })

  it('never reads a document the person cannot open', async () => {
    expect(
      await askPassagesHybrid(viewerOf(stranger), 'quanto recesso eu tenho?'),
    ).toEqual([])
    expect(
      (
        await askPassagesHybrid(viewerOf(guest), 'quanto recesso eu tenho?')
      ).map((passage) => passage.id),
    ).toEqual([])
  })

  it('falls back to the full-text search when embeddings are off', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const passages = await askPassagesHybrid(
      viewerOf(owner),
      'quantos dias de férias eu tenho?',
    )

    expect(passages.map((passage) => passage.id)).toEqual(['doc-private'])
  })

  it('keeps working when the embedding provider is down', async () => {
    embedding.broken = true

    const passages = await askPassagesHybrid(
      viewerOf(owner),
      'quantos dias de férias eu tenho?',
    )

    expect(passages.map((passage) => passage.id)).toEqual(['doc-private'])
  })
})

describe('scheduleSearchIndexReconcile', () => {
  it('fills the two indexes in the background of a search', async () => {
    await db.execute(sql`delete from documents_fts`)
    await db.execute(sql`delete from document_chunks`)

    scheduleSearchIndexReconcile()

    await vi.waitFor(
      async () => {
        expect(await indexedDocumentCount('documents_fts')).toBe(6)
        expect(await indexedDocumentCount('document_chunks')).toBe(5)
      },
      { timeout: 15_000, interval: 100 },
    )
  })
})

import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const embedding = vi.hoisted(() => ({
  calls: [] as Array<Array<string>>,
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
      embedding.calls.push([...values])

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
import {
  EMBEDDING_BATCH_SIZE,
  VECTOR_CACHE_TTL,
  clearSemanticCache,
  indexDocumentChunks,
  reconcileSemanticIndex,
  removeDocumentChunks,
  searchSemanticDocuments,
} from '@/lib/semantic-index'

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

function longDocument(blocks: number) {
  const filler = Array.from({ length: 160 }, () => 'palavra').join(' ')

  return paragraphs(
    ...Array.from({ length: blocks }, (_, index) => `Bloco ${index} ${filler}`),
  )
}

type ChunkRow = Readonly<{
  chunkIndex: number
  body: string
  model: string
  indexedAt: string
  bytes: number
}>

async function chunkRowsOf(documentId: string): Promise<Array<ChunkRow>> {
  const result = (await db.execute(sql`
    select
      chunk_index as chunkIndex,
      body as body,
      model as model,
      indexed_at as indexedAt,
      length(embedding) as bytes
    from document_chunks
    where document_id = ${documentId}
    order by chunk_index
  `)) as unknown as [Array<ChunkRow>, unknown]

  return result[0]
}

async function indexedDocumentIds(): Promise<Array<string>> {
  const result = (await db.execute(
    sql`select distinct document_id as documentId from document_chunks order by document_id`,
  )) as unknown as [Array<{ documentId: string }>, unknown]

  return result[0].map((row) => row.documentId)
}

async function updatedAtOf(documentId: string): Promise<string> {
  const result = (await db.execute(
    sql`select updated_at as updatedAt from documents where id = ${documentId}`,
  )) as unknown as [Array<{ updatedAt: string }>, unknown]

  return result[0][0].updatedAt
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
  embedding.calls.length = 0
  clearSemanticCache()
  await resetDatabase()
  await seed()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('indexDocumentChunks', () => {
  it('writes a row per chunk stamped with the version it read', async () => {
    await indexDocumentChunks('doc-private')

    const rows = await chunkRowsOf('doc-private')

    expect(rows).toHaveLength(1)
    expect(rows[0].body).toContain('trinta dias de férias')
    expect(rows[0].bytes).toBe(4 * 4)
    expect(rows[0].indexedAt).toBe(await updatedAtOf('doc-private'))
  })

  it('embeds the chunk together with the title of the document', async () => {
    await indexDocumentChunks('doc-private')

    expect(embedding.calls[0][0].startsWith('Política de férias')).toBe(true)
  })

  it('replaces the rows of the previous version', async () => {
    await indexDocumentChunks('doc-private')

    await db
      .update(documents)
      .set({
        content: paragraphs('Agora o texto fala de deploy.'),
        updatedAt: new Date(Date.now() + 60_000),
      })
      .where(sql`id = 'doc-private'`)

    await indexDocumentChunks('doc-private')

    const rows = await chunkRowsOf('doc-private')

    expect(rows).toHaveLength(1)
    expect(rows[0].body).toContain('deploy')
  })

  it('leaves only a freshness mark on a document without text', async () => {
    await db
      .update(documents)
      .set({ content: paragraphs('') })
      .where(sql`id = 'doc-private'`)

    await indexDocumentChunks('doc-private')

    const rows = await chunkRowsOf('doc-private')

    expect(rows).toHaveLength(1)
    expect(rows[0].body).toBe('')
    expect(rows[0].bytes).toBe(0)
  })

  it('drops the rows of a document that is gone', async () => {
    await indexDocumentChunks('doc-private')
    await db.delete(documents).where(sql`id = 'doc-private'`)
    await indexDocumentChunks('doc-private')

    expect(await chunkRowsOf('doc-private')).toEqual([])
  })

  it('drops the rows when the workspace has no key for embeddings', async () => {
    await indexDocumentChunks('doc-private')

    vi.stubEnv('OPENAI_API_KEY', '')

    await indexDocumentChunks('doc-private')

    expect(await chunkRowsOf('doc-private')).toEqual([])
  })

  it('removes the rows of a single document', async () => {
    await indexDocumentChunks('doc-private')
    await removeDocumentChunks('doc-private')

    expect(await chunkRowsOf('doc-private')).toEqual([])
  })
})

describe('reconcileSemanticIndex', () => {
  it('walks only the budget it was given and says what it did', async () => {
    expect(await reconcileSemanticIndex(2)).toBe(2)
    expect(await indexedDocumentIds()).toHaveLength(2)

    expect(await reconcileSemanticIndex(10)).toBe(1)
    expect(await indexedDocumentIds()).toEqual([
      'doc-org',
      'doc-private',
      'doc-shared',
    ])
  })

  it('never spends a call on what is already fresh', async () => {
    await reconcileSemanticIndex(10)

    embedding.calls.length = 0

    expect(await reconcileSemanticIndex(10)).toBe(0)
    expect(embedding.calls).toEqual([])
  })

  it('comes back to a document after it changes', async () => {
    await reconcileSemanticIndex(10)

    await db
      .update(documents)
      .set({
        content: paragraphs('Agora o texto fala de deploy e release.'),
        updatedAt: new Date(Date.now() + 60_000),
      })
      .where(sql`id = 'doc-private'`)

    expect(await reconcileSemanticIndex(10)).toBe(1)
    expect((await chunkRowsOf('doc-private'))[0].body).toContain('release')
  })

  it('stops asking about a document that has no text', async () => {
    await db
      .update(documents)
      .set({ content: paragraphs('') })
      .where(sql`id = 'doc-private'`)

    expect(await reconcileSemanticIndex(10)).toBe(3)
    expect(await reconcileSemanticIndex(10)).toBe(0)
  })

  it('leaves the trash out of the index', async () => {
    await reconcileSemanticIndex(10)

    expect(await indexedDocumentIds()).not.toContain('doc-trashed')
  })

  it('does the embedding in batches instead of one giant call', async () => {
    const now = new Date()

    await db.insert(documents).values([
      {
        id: 'doc-long-1',
        ownerId: owner.id,
        title: 'Manual longo um',
        content: longDocument(70),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-long-2',
        ownerId: owner.id,
        title: 'Manual longo dois',
        content: longDocument(70),
        createdAt: now,
        updatedAt: now,
      },
    ])

    await reconcileSemanticIndex(10)

    const sizes = embedding.calls.map((call) => call.length)

    expect(sizes.length).toBeGreaterThan(1)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(EMBEDDING_BATCH_SIZE)
  })

  it('does nothing when the workspace has no key for embeddings', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    expect(await reconcileSemanticIndex(10)).toBe(0)
    expect(await indexedDocumentIds()).toEqual([])
  })
})

describe('searchSemanticDocuments', () => {
  beforeEach(async () => {
    await reconcileSemanticIndex(10)
    clearSemanticCache()
  })

  it('finds a document by meaning, without a word in common', async () => {
    const hits = await searchSemanticDocuments(
      viewerOf(owner),
      'quanto recesso eu tenho por ano',
    )

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
    expect(hits[0].body).toContain('férias')
    expect(hits[0].score).toBeGreaterThan(0.9)
  })

  it('never hands somebody else a private document', async () => {
    expect(
      await searchSemanticDocuments(viewerOf(stranger), 'quanto recesso'),
    ).toEqual([])
    expect(
      await searchSemanticDocuments(viewerOf(member), 'quanto recesso'),
    ).toEqual([])
    expect(
      await searchSemanticDocuments(viewerOf(guest), 'quanto recesso'),
    ).toEqual([])
  })

  it('returns a document shared directly with the person', async () => {
    const hits = await searchSemanticDocuments(
      viewerOf(guest),
      'preciso da ata daquela conversa',
    )

    expect(hits.map((hit) => hit.id)).toEqual(['doc-shared'])
  })

  it('returns a document open to the organization only to its members', async () => {
    const hits = await searchSemanticDocuments(
      viewerOf(member),
      'como funciona a cultura da casa',
    )

    expect(hits.map((hit) => hit.id)).toEqual(['doc-org'])
    expect(
      await searchSemanticDocuments(
        viewerOf(stranger),
        'como funciona a cultura da casa',
      ),
    ).toEqual([])
  })

  it('keeps the trash out of the answer', async () => {
    const hits = await searchSemanticDocuments(
      viewerOf(owner),
      'preciso de folga e descanso',
    )

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('says nothing when nothing is close enough', async () => {
    expect(
      await searchSemanticDocuments(viewerOf(owner), 'deploy e release'),
    ).toEqual([])
  })

  it('says nothing when the workspace has no key for embeddings', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    expect(
      await searchSemanticDocuments(viewerOf(owner), 'quanto recesso'),
    ).toEqual([])
  })

  it('sees a document that was indexed after the cache was warm', async () => {
    const now = new Date()

    await searchSemanticDocuments(viewerOf(owner), 'quanto recesso')

    await db.insert(documents).values({
      id: 'doc-new',
      ownerId: owner.id,
      title: 'Calendário de recesso',
      content: paragraphs('O recesso de fim de ano fecha a escola.'),
      createdAt: now,
      updatedAt: now,
    })

    await indexDocumentChunks('doc-new')

    vi.spyOn(Date, 'now').mockReturnValue(now.getTime() + VECTOR_CACHE_TTL * 2)

    const hits = await searchSemanticDocuments(viewerOf(owner), 'quanto recesso')

    expect(hits.map((hit) => hit.id)).toContain('doc-new')
  })

  it('forgets a document whose chunks were removed', async () => {
    await searchSemanticDocuments(viewerOf(owner), 'quanto recesso')

    await removeDocumentChunks('doc-private')

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + VECTOR_CACHE_TTL * 2)

    expect(
      await searchSemanticDocuments(viewerOf(owner), 'quanto recesso'),
    ).toEqual([])
  })
})

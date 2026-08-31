import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('@/db/schema')

  const sqlite = new Database(':memory:')
  const folder = join(process.cwd(), 'drizzle')
  const files = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const contents = readFileSync(join(folder, file), 'utf8')

    for (const statement of contents.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()

      if (trimmed.length > 0) {
        sqlite.exec(trimmed)
      }
    }
  }

  return { db: drizzle(sqlite, { schema }), schema }
})

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import {
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  buildMatchExpression,
  documentBodyText,
  indexDocument,
  listRecentAccessibleDocuments,
  parseSnippet,
  removeDocumentFromIndex,
  searchAccessibleDocuments,
} from '@/lib/search-index'

const owner = { id: 'user-owner', email: 'dono@arvore.com.br' }
const guest = { id: 'user-guest', email: 'convidado@arvore.com.br' }
const member = { id: 'user-member', email: 'membro@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'fora@arvore.com.br' }

const org = 'org-arvore'

function viewerOf(person: { id: string; email: string }) {
  return { userId: person.id, email: person.email }
}

function paragraph(text: string) {
  return JSON.stringify([
    { id: 'b1', type: 'paragraph', content: [{ type: 'text', text }] },
  ])
}

async function seed() {
  await db.run(sql`delete from documents_fts`)
  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

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
    .values({ id: org, name: 'Escola Árvore', createdAt: now })

  await db.insert(organizationMembers).values([
    { id: 'm-owner', orgId: org, userId: owner.id, role: 'owner', createdAt: now },
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
      title: 'Plano de leitura',
      content: paragraph(
        'O relatório da educação básica trata de avaliação e de leitura crítica.',
      ),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-shared',
      ownerId: owner.id,
      orgId: org,
      title: 'Ata da reunião',
      content: paragraph('Combinamos o cronograma do trimestre.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org',
      ownerId: owner.id,
      orgId: org,
      orgAccess: 'viewer',
      title: 'Manual da equipe',
      content: paragraph('Rotinas de onboarding e cultura.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-trashed',
      ownerId: owner.id,
      title: 'Rascunho antigo',
      content: paragraph('Texto sobre leitura que foi descartado.'),
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
  await seed()
})

describe('buildMatchExpression', () => {
  it('turns each word into a prefix term', () => {
    expect(buildMatchExpression('plano leitura')).toBe('"plano"* "leitura"*')
  })

  it('drops punctuation and fts operators', () => {
    expect(buildMatchExpression('  NEAR("a" OR b) -c  ')).toBe(
      '"NEAR"* "a"* "OR"* "b"* "c"*',
    )
  })

  it('returns null when there is nothing to match', () => {
    expect(buildMatchExpression('   ')).toBeNull()
    expect(buildMatchExpression('*^&')).toBeNull()
  })
})

describe('parseSnippet', () => {
  it('splits highlighted and plain segments', () => {
    const value = `antes ${HIGHLIGHT_START}termo${HIGHLIGHT_END} depois`

    expect(parseSnippet(value)).toEqual([
      { text: 'antes ', highlight: false },
      { text: 'termo', highlight: true },
      { text: ' depois', highlight: false },
    ])
  })

  it('keeps plain text without markers', () => {
    expect(parseSnippet('só texto')).toEqual([
      { text: 'só texto', highlight: false },
    ])
  })
})

describe('documentBodyText', () => {
  it('extracts the plain text of the blocks', () => {
    expect(documentBodyText(paragraph('Olá  mundo'))).toBe('Olá mundo')
  })

  it('survives content that is not valid json', () => {
    expect(documentBodyText('{isto nao e json')).toBe('')
    expect(documentBodyText(null)).toBe('')
  })
})

describe('searchAccessibleDocuments', () => {
  it('finds a document by a word in the title', () => {
    const hits = searchAccessibleDocuments(viewerOf(owner), 'plano')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('finds a document by a word in the body and ignores accents', () => {
    const hits = searchAccessibleDocuments(viewerOf(owner), 'relatorio')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('marks the matched term inside the excerpt', () => {
    const [hit] = searchAccessibleDocuments(viewerOf(owner), 'educacao')

    expect(hit.segments.some((segment) => segment.highlight)).toBe(true)
    expect(
      hit.segments
        .filter((segment) => segment.highlight)
        .map((segment) => segment.text),
    ).toEqual(['educação'])
  })

  it('never returns a private document of someone else', () => {
    expect(searchAccessibleDocuments(viewerOf(stranger), 'plano')).toEqual([])
    expect(searchAccessibleDocuments(viewerOf(stranger), 'leitura')).toEqual([])
    expect(searchAccessibleDocuments(viewerOf(guest), 'plano')).toEqual([])
    expect(searchAccessibleDocuments(viewerOf(member), 'plano')).toEqual([])
  })

  it('returns a document shared directly with the person', () => {
    const hits = searchAccessibleDocuments(viewerOf(guest), 'cronograma')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-shared'])
  })

  it('returns a document opened to the organization only to its members', () => {
    expect(
      searchAccessibleDocuments(viewerOf(member), 'onboarding').map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-org'])
    expect(searchAccessibleDocuments(viewerOf(stranger), 'onboarding')).toEqual(
      [],
    )
  })

  it('skips documents in the trash', () => {
    const hits = searchAccessibleDocuments(viewerOf(owner), 'leitura')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('requires every word of the query to match', () => {
    expect(searchAccessibleDocuments(viewerOf(owner), 'plano leitura')).toHaveLength(1)
    expect(searchAccessibleDocuments(viewerOf(owner), 'plano cronograma')).toEqual([])
  })

  it('matches by prefix', () => {
    expect(
      searchAccessibleDocuments(viewerOf(owner), 'avali').map((hit) => hit.id),
    ).toEqual(['doc-private'])
  })

  it('returns nothing for a blank query', () => {
    expect(searchAccessibleDocuments(viewerOf(owner), '   ')).toEqual([])
  })
})

describe('index maintenance', () => {
  it('reindexes a document after the content changes', async () => {
    searchAccessibleDocuments(viewerOf(owner), 'plano')

    await db
      .update(documents)
      .set({
        content: paragraph('Agora fala de astronomia.'),
        updatedAt: new Date(Date.now() + 60_000),
      })
      .where(sql`id = 'doc-private'`)

    indexDocument('doc-private')

    expect(
      searchAccessibleDocuments(viewerOf(owner), 'astronomia').map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-private'])
    expect(searchAccessibleDocuments(viewerOf(owner), 'relatorio')).toEqual([])
  })

  it('picks up a document that was never indexed explicitly', () => {
    expect(
      searchAccessibleDocuments(viewerOf(owner), 'manual').map((hit) => hit.id),
    ).toEqual(['doc-org'])
  })

  it('drops rows of documents that no longer exist', async () => {
    indexDocument('doc-private')
    await db.delete(documents).where(sql`id = 'doc-private'`)

    expect(searchAccessibleDocuments(viewerOf(owner), 'plano')).toEqual([])
  })

  it('removes a single document from the index', () => {
    indexDocument('doc-private')
    removeDocumentFromIndex('doc-private')

    const rows = db.all<{ total: number }>(
      sql`select count(*) as total from documents_fts where document_id = 'doc-private'`,
    )

    expect(rows[0].total).toBe(0)
  })
})

describe('listRecentAccessibleDocuments', () => {
  it('lists only what the person can open', () => {
    expect(listRecentAccessibleDocuments(viewerOf(owner)).length).toBe(3)
    expect(
      listRecentAccessibleDocuments(viewerOf(guest)).map((hit) => hit.id),
    ).toEqual(['doc-shared'])
    expect(
      listRecentAccessibleDocuments(viewerOf(member)).map((hit) => hit.id),
    ).toEqual(['doc-org'])
    expect(listRecentAccessibleDocuments(viewerOf(stranger))).toEqual([])
  })

  it('respects the limit', () => {
    expect(listRecentAccessibleDocuments(viewerOf(owner), 1)).toHaveLength(1)
  })
})

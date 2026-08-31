import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
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
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  buildMatchExpression,
  buildSnippet,
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
  await resetDatabase()
  await seed()
})

describe('buildMatchExpression', () => {
  it('turns each word into a required prefix term', () => {
    expect(buildMatchExpression('plano leitura')).toBe('+plano* +leitura*')
  })

  it('drops punctuation and boolean operators', () => {
    expect(buildMatchExpression('  NEAR("a" OR b) -c  ')).toBe(
      '+NEAR* +a* +OR* +b* +c*',
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

describe('buildSnippet', () => {
  it('highlights the whole matched word ignoring accents', () => {
    const snippet = buildSnippet('trata de avaliação e de leitura', ['avali'])

    expect(parseSnippet(snippet)).toEqual([
      { text: 'trata de ', highlight: false },
      { text: 'avaliação', highlight: true },
      { text: ' e de leitura', highlight: false },
    ])
  })

  it('trims long bodies around the match', () => {
    const body = `${'palavra '.repeat(20)}alvo ${'depois '.repeat(20)}`.trim()
    const snippet = buildSnippet(body, ['alvo'])

    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain(`${HIGHLIGHT_START}alvo${HIGHLIGHT_END}`)
  })

  it('returns an empty snippet for an empty body', () => {
    expect(buildSnippet('', ['alvo'])).toBe('')
  })
})

describe('searchAccessibleDocuments', () => {
  it('finds a document by a word in the title', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'plano')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('finds a document by a word in the body and ignores accents', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'relatorio')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('marks the matched term inside the excerpt', async () => {
    const [hit] = await searchAccessibleDocuments(viewerOf(owner), 'educacao')

    expect(hit.segments.some((segment) => segment.highlight)).toBe(true)
    expect(
      hit.segments
        .filter((segment) => segment.highlight)
        .map((segment) => segment.text),
    ).toEqual(['educação'])
  })

  it('never returns a private document of someone else', async () => {
    expect(
      await searchAccessibleDocuments(viewerOf(stranger), 'plano'),
    ).toEqual([])
    expect(
      await searchAccessibleDocuments(viewerOf(stranger), 'leitura'),
    ).toEqual([])
    expect(await searchAccessibleDocuments(viewerOf(guest), 'plano')).toEqual([])
    expect(await searchAccessibleDocuments(viewerOf(member), 'plano')).toEqual(
      [],
    )
  })

  it('returns a document shared directly with the person', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(guest), 'cronograma')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-shared'])
  })

  it('returns a document opened to the organization only to its members', async () => {
    const forMember = await searchAccessibleDocuments(
      viewerOf(member),
      'onboarding',
    )

    expect(forMember.map((hit) => hit.id)).toEqual(['doc-org'])
    expect(
      await searchAccessibleDocuments(viewerOf(stranger), 'onboarding'),
    ).toEqual([])
  })

  it('skips documents in the trash', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'leitura')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('requires every word of the query to match', async () => {
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'plano leitura'),
    ).toHaveLength(1)
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'plano cronograma'),
    ).toEqual([])
  })

  it('matches by prefix', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'avali')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('returns nothing for a blank query', async () => {
    expect(await searchAccessibleDocuments(viewerOf(owner), '   ')).toEqual([])
  })
})

describe('index maintenance', () => {
  it('reindexes a document after the content changes', async () => {
    await searchAccessibleDocuments(viewerOf(owner), 'plano')

    await db
      .update(documents)
      .set({
        content: paragraph('Agora fala de astronomia.'),
        updatedAt: new Date(Date.now() + 60_000),
      })
      .where(sql`id = 'doc-private'`)

    await indexDocument('doc-private')

    const found = await searchAccessibleDocuments(
      viewerOf(owner),
      'astronomia',
    )

    expect(found.map((hit) => hit.id)).toEqual(['doc-private'])
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'relatorio'),
    ).toEqual([])
  })

  it('picks up a document that was never indexed explicitly', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'manual')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-org'])
  })

  it('drops rows of documents that no longer exist', async () => {
    await indexDocument('doc-private')
    await db.delete(documents).where(sql`id = 'doc-private'`)

    expect(await searchAccessibleDocuments(viewerOf(owner), 'plano')).toEqual([])
  })

  it('removes a single document from the index', async () => {
    await indexDocument('doc-private')
    await removeDocumentFromIndex('doc-private')

    const result = (await db.execute(
      sql`select count(*) as total from documents_fts where document_id = 'doc-private'`,
    )) as unknown as [Array<{ total: number }>, unknown]

    expect(Number(result[0][0].total)).toBe(0)
  })
})

describe('listRecentAccessibleDocuments', () => {
  it('lists only what the person can open', async () => {
    expect(
      (await listRecentAccessibleDocuments(viewerOf(owner))).length,
    ).toBe(3)
    expect(
      (await listRecentAccessibleDocuments(viewerOf(guest))).map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-shared'])
    expect(
      (await listRecentAccessibleDocuments(viewerOf(member))).map(
        (hit) => hit.id,
      ),
    ).toEqual(['doc-org'])
    expect(await listRecentAccessibleDocuments(viewerOf(stranger))).toEqual([])
  })

  it('respects the limit', async () => {
    expect(await listRecentAccessibleDocuments(viewerOf(owner), 1)).toHaveLength(
      1,
    )
  })
})

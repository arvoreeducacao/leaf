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
  reconcileSearchIndex,
  removeDocumentFromIndex,
  askTokens,
  buildAskMatchExpression,
  searchAccessibleDocumentBodies,
  searchAccessibleDocuments,
} from '@/lib/search-index'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }
const guest = { id: 'user-guest', email: 'guest@arvore.com.br' }
const member = { id: 'user-member', email: 'member@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'outside@arvore.com.br' }

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
    .values({ id: org, name: 'Árvore School', createdAt: now })

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
      title: 'Reading plan',
      content: paragraph(
        'The résumé of basic education covers assessment and critical reading.',
      ),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-shared',
      ownerId: owner.id,
      orgId: org,
      title: 'Meeting minutes',
      content: paragraph('We agreed on the schedule of the term.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org',
      ownerId: owner.id,
      orgId: org,
      orgAccess: 'viewer',
      title: 'Team manual',
      content: paragraph('Onboarding routines and culture.'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-trashed',
      ownerId: owner.id,
      title: 'Old draft',
      content: paragraph('Text about reading that was discarded.'),
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
  await reconcileSearchIndex()
})

describe('buildMatchExpression', () => {
  it('turns each word into a required prefix term', () => {
    expect(buildMatchExpression('reading plan')).toBe('+reading* +plan*')
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
    const value = `before ${HIGHLIGHT_START}term${HIGHLIGHT_END} after`

    expect(parseSnippet(value)).toEqual([
      { text: 'before ', highlight: false },
      { text: 'term', highlight: true },
      { text: ' after', highlight: false },
    ])
  })

  it('keeps plain text without markers', () => {
    expect(parseSnippet('plain text')).toEqual([
      { text: 'plain text', highlight: false },
    ])
  })
})

describe('documentBodyText', () => {
  it('extracts the plain text of the blocks', () => {
    expect(documentBodyText(paragraph('Hello  world'))).toBe('Hello world')
  })

  it('survives content that is not valid json', () => {
    expect(documentBodyText('{this is not json')).toBe('')
    expect(documentBodyText(null)).toBe('')
  })
})

describe('buildSnippet', () => {
  it('highlights the whole matched word ignoring accents', () => {
    const snippet = buildSnippet('covers the résumé and the reading', ['resum'])

    expect(parseSnippet(snippet)).toEqual([
      { text: 'covers the ', highlight: false },
      { text: 'résumé', highlight: true },
      { text: ' and the reading', highlight: false },
    ])
  })

  it('trims long bodies around the match', () => {
    const body = `${'word '.repeat(20)}target ${'after '.repeat(20)}`.trim()
    const snippet = buildSnippet(body, ['target'])

    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain(`${HIGHLIGHT_START}target${HIGHLIGHT_END}`)
  })

  it('returns an empty snippet for an empty body', () => {
    expect(buildSnippet('', ['target'])).toBe('')
  })
})

describe('askTokens', () => {
  it('drops the words that carry no meaning in a question', () => {
    expect(askTokens('quantos dias antes preciso pedir férias e quem aprova?')).toEqual(
      ['quantos', 'dias', 'antes', 'preciso', 'pedir', 'férias', 'aprova'],
    )
  })

  it('keeps nothing when the question is only function words', () => {
    expect(askTokens('o que é isso?')).toEqual([])
    expect(buildAskMatchExpression('o que é isso?')).toBeNull()
  })
})

describe('buildAskMatchExpression', () => {
  it('ranks by any word instead of demanding all of them', () => {
    expect(buildAskMatchExpression('como funciona o deploy do Leaf')).toBe(
      'funciona* deploy* Leaf*',
    )
  })
})

describe('searchAccessibleDocumentBodies', () => {
  it('answers a whole question, without demanding every word of it', async () => {
    const passages = await searchAccessibleDocumentBodies(
      viewerOf(owner),
      'what does the assessment say about critical reading?',
    )

    expect(passages.map((passage) => passage.id)).toContain('doc-private')
  })

  it('returns the whole body, which is what the AI answer reads', async () => {
    const passages = await searchAccessibleDocumentBodies(
      viewerOf(owner),
      'resume',
    )

    expect(passages.map((passage) => passage.id)).toEqual(['doc-private'])
    expect(passages[0].body.length).toBeGreaterThan(0)
  })

  it('never returns a document the person cannot open', async () => {
    expect(
      await searchAccessibleDocumentBodies(viewerOf(stranger), 'plan'),
    ).toEqual([])
    expect(
      await searchAccessibleDocumentBodies(viewerOf(member), 'plan'),
    ).toEqual([])
    expect(
      (
        await searchAccessibleDocumentBodies(viewerOf(guest), 'schedule')
      ).map((passage) => passage.id),
    ).toEqual(['doc-shared'])
  })
})

describe('searchAccessibleDocuments', () => {
  it('finds a document by a word in the title', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'plan')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('finds a document by a word in the body and ignores accents', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'resume')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('marks the matched term inside the excerpt', async () => {
    const [hit] = await searchAccessibleDocuments(viewerOf(owner), 'resume')

    expect(hit.segments.some((segment) => segment.highlight)).toBe(true)
    expect(
      hit.segments
        .filter((segment) => segment.highlight)
        .map((segment) => segment.text),
    ).toEqual(['résumé'])
  })

  it('never returns a private document of someone else', async () => {
    expect(
      await searchAccessibleDocuments(viewerOf(stranger), 'plan'),
    ).toEqual([])
    expect(
      await searchAccessibleDocuments(viewerOf(stranger), 'reading'),
    ).toEqual([])
    expect(await searchAccessibleDocuments(viewerOf(guest), 'plan')).toEqual([])
    expect(await searchAccessibleDocuments(viewerOf(member), 'plan')).toEqual(
      [],
    )
  })

  it('returns a document shared directly with the person', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(guest), 'schedule')

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
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'reading')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('requires every word of the query to match', async () => {
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'reading plan'),
    ).toHaveLength(1)
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'plan schedule'),
    ).toEqual([])
  })

  it('matches by prefix', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'assess')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-private'])
  })

  it('returns nothing for a blank query', async () => {
    expect(await searchAccessibleDocuments(viewerOf(owner), '   ')).toEqual([])
  })
})

describe('index maintenance', () => {
  it('reindexes a document after the content changes', async () => {
    await searchAccessibleDocuments(viewerOf(owner), 'plan')

    await db
      .update(documents)
      .set({
        content: paragraph('Now it talks about astronomy.'),
        updatedAt: new Date(Date.now() + 60_000),
      })
      .where(sql`id = 'doc-private'`)

    await indexDocument('doc-private')

    const found = await searchAccessibleDocuments(
      viewerOf(owner),
      'astronomy',
    )

    expect(found.map((hit) => hit.id)).toEqual(['doc-private'])
    expect(
      await searchAccessibleDocuments(viewerOf(owner), 'resume'),
    ).toEqual([])
  })

  it('picks up a document that was never indexed explicitly', async () => {
    const hits = await searchAccessibleDocuments(viewerOf(owner), 'manual')

    expect(hits.map((hit) => hit.id)).toEqual(['doc-org'])
  })

  it('drops rows of documents that no longer exist', async () => {
    await indexDocument('doc-private')
    await db.delete(documents).where(sql`id = 'doc-private'`)

    expect(await searchAccessibleDocuments(viewerOf(owner), 'plan')).toEqual([])
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

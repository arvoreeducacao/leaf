import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  documentShares,
  documentVisits,
  documents,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { listVisitedDocuments, recordDocumentVisit } from '@/lib/document-visits'

const owner = { id: 'user-owner', email: 'owner@example.com' }
const reader = { id: 'user-reader', email: 'reader@example.com' }
const outsider = { id: 'user-outsider', email: 'outsider@example.com' }

const org = 'org-acme'

function viewerOf(person: { id: string; email: string }) {
  return { userId: person.id, email: person.email }
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000)
}

async function idsVisitedBy(person: { id: string; email: string }, limit = 15) {
  return (await listVisitedDocuments(viewerOf(person), limit)).map(
    (document) => document.id,
  )
}

beforeEach(async () => {
  await resetDatabase()

  const now = new Date()

  await db.insert(user).values(
    [owner, reader, outsider].map((person) => ({
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
    .values({ id: org, name: 'Acme', createdAt: now })

  await db.insert(organizationMembers).values([
    { id: 'm-owner', orgId: org, userId: owner.id, role: 'owner', createdAt: now },
    { id: 'm-reader', orgId: org, userId: reader.id, role: 'member', createdAt: now },
  ])

  await db.insert(documents).values([
    { id: 'doc-a', ownerId: owner.id, title: 'A', createdAt: now, updatedAt: now },
    { id: 'doc-b', ownerId: owner.id, title: 'B', createdAt: now, updatedAt: now },
    {
      id: 'doc-org',
      ownerId: owner.id,
      orgId: org,
      orgAccess: 'viewer',
      title: 'Org',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-shared',
      ownerId: owner.id,
      title: 'Shared',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-template',
      ownerId: owner.id,
      kind: 'template',
      title: 'Template',
      createdAt: now,
      updatedAt: now,
    },
  ])

  await db.insert(documentShares).values({
    id: 'share-1',
    documentId: 'doc-shared',
    granteeEmail: reader.email,
    role: 'viewer',
    createdAt: now,
  })
})

describe('listVisitedDocuments', () => {
  it('is empty before the person opens anything', async () => {
    expect(await idsVisitedBy(owner)).toEqual([])
  })

  it('lists what the person opened, most recent first', async () => {
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(10))
    await recordDocumentVisit(owner.id, 'doc-b', minutesAgo(5))
    await recordDocumentVisit(owner.id, 'doc-org', minutesAgo(1))

    expect(await idsVisitedBy(owner)).toEqual(['doc-org', 'doc-b', 'doc-a'])
  })

  it('ignores what other people opened', async () => {
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(1))

    expect(await idsVisitedBy(reader)).toEqual([])
  })

  it('moves a reopened document back to the top without duplicating it', async () => {
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(10))
    await recordDocumentVisit(owner.id, 'doc-b', minutesAgo(5))
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(1))

    expect(await idsVisitedBy(owner)).toEqual(['doc-a', 'doc-b'])

    const rows = await db
      .select()
      .from(documentVisits)
      .where(eq(documentVisits.userId, owner.id))

    expect(rows).toHaveLength(2)
  })

  it('drops documents the person can no longer open', async () => {
    await recordDocumentVisit(reader.id, 'doc-shared', minutesAgo(5))
    await recordDocumentVisit(reader.id, 'doc-org', minutesAgo(1))
    await recordDocumentVisit(outsider.id, 'doc-a', minutesAgo(1))

    await db.delete(documentShares).where(eq(documentShares.id, 'share-1'))

    expect(await idsVisitedBy(reader)).toEqual(['doc-org'])
    expect(await idsVisitedBy(outsider)).toEqual([])
  })

  it('skips trashed documents and templates', async () => {
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(5))
    await recordDocumentVisit(owner.id, 'doc-b', minutesAgo(3))
    await recordDocumentVisit(owner.id, 'doc-template', minutesAgo(1))

    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, 'doc-b'))

    expect(await idsVisitedBy(owner)).toEqual(['doc-a'])
  })

  it('tells whether the person owns each document', async () => {
    await recordDocumentVisit(reader.id, 'doc-org', minutesAgo(1))
    await recordDocumentVisit(owner.id, 'doc-org', minutesAgo(1))

    const [asReader] = await listVisitedDocuments(viewerOf(reader), 15)
    const [asOwner] = await listVisitedDocuments(viewerOf(owner), 15)

    expect(asReader).toMatchObject({ id: 'doc-org', owned: false, title: 'Org' })
    expect(asOwner).toMatchObject({ id: 'doc-org', owned: true })
    expect(asOwner?.updatedAt).toBeInstanceOf(Date)
  })

  it('respects the limit', async () => {
    await recordDocumentVisit(owner.id, 'doc-a', minutesAgo(5))
    await recordDocumentVisit(owner.id, 'doc-b', minutesAgo(1))

    expect(await idsVisitedBy(owner, 1)).toEqual(['doc-b'])
  })
})

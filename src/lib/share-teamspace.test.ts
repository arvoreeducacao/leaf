import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    return (key: string) => `${namespace}.${key}`
  },
}))

const owner = { id: 'user-owner', email: 'owner@example.com' }
const guest = { id: 'user-guest', email: 'guest@example.com' }
const activeSession = { user: owner }

vi.mock('@/lib/auth', () => ({
  getSession: async () => activeSession,
}))

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationMembers,
  organizations,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { loadShareState } from '@/lib/share-actions'

const orgId = 'org-acme'
const documentId = 'doc-shared'

async function placeDocument(teamspaceId: string | null) {
  await db
    .update(documents)
    .set({ teamspaceId })
    .where(eq(documents.id, documentId))
}

async function loadTeamspace() {
  const result = await loadShareState(documentId)

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.state
}

beforeEach(async () => {
  await resetDatabase()
  activeSession.user = owner

  const now = new Date()

  await db.insert(user).values(
    [owner, guest].map((person) => ({
      id: person.id,
      name: person.id,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db
    .insert(organizations)
    .values({ id: orgId, name: 'Acme School', createdAt: now })

  await db.insert(organizationMembers).values({
    id: 'member-owner',
    orgId,
    userId: owner.id,
    role: 'member',
    createdAt: now,
  })

  await db.insert(teamspaces).values([
    { id: 'ts-open', orgId, name: 'Year One', access: 'open', createdAt: now },
    {
      id: 'ts-closed',
      orgId,
      name: 'Finance',
      access: 'closed',
      createdAt: now,
    },
  ])

  await db.insert(documents).values({
    id: documentId,
    ownerId: owner.id,
    orgId,
    orgAccess: null,
    title: 'Shared document',
    createdAt: now,
    updatedAt: now,
  })
})

describe('share state of a document in a teamspace', () => {
  it('has no teamspace when the document is outside one', async () => {
    expect((await loadTeamspace()).teamspace).toBeNull()
  })

  it('tells that everyone in the organization sees an open teamspace', async () => {
    await placeDocument('ts-open')

    const state = await loadTeamspace()

    expect(state.orgAccess).toBeNull()
    expect(state.teamspace).toEqual({
      name: 'Year One',
      open: true,
      orgName: 'Acme School',
    })
  })

  it('tells that only members see a closed teamspace', async () => {
    await placeDocument('ts-closed')

    expect((await loadTeamspace()).teamspace).toEqual({
      name: 'Finance',
      open: false,
      orgName: 'Acme School',
    })
  })

  it('hides the teamspace from a guest outside the organization', async () => {
    await placeDocument('ts-closed')
    await db.insert(documentShares).values({
      id: 'share-guest',
      documentId,
      granteeEmail: guest.email,
      role: 'viewer',
    })
    activeSession.user = guest

    expect((await loadTeamspace()).teamspace).toBeNull()
  })
})

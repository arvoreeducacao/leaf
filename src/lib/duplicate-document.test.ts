import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))

const currentUser = vi.hoisted(() => ({ id: '', email: '' }))

vi.mock('@/lib/auth', () => ({
  getSession: async () => ({ user: { ...currentUser } }),
}))

vi.mock('@/lib/search-index', () => ({
  indexDocument: async () => undefined,
  removeDocumentFromIndex: async () => undefined,
}))

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationMembers,
  organizations,
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { duplicateDocument } from '@/lib/document-actions'

const author = { id: 'dup-author', email: 'author@example.com' }
const teammate = { id: 'dup-teammate', email: 'teammate@example.com' }
const reader = { id: 'dup-reader', email: 'reader@example.com' }
const stranger = { id: 'dup-stranger', email: 'stranger@example.com' }

const orgId = 'dup-org'
const teamspaceId = 'dup-teamspace'

function signIn(person: { id: string; email: string }) {
  currentUser.id = person.id
  currentUser.email = person.email
}

async function copyOf(result: Awaited<ReturnType<typeof duplicateDocument>>) {
  if (!result.ok) {
    throw new Error(result.error)
  }

  const copy = await db.query.documents.findFirst({
    where: eq(documents.id, result.id),
  })

  if (!copy) {
    throw new Error('copy not found')
  }

  return copy
}

beforeEach(async () => {
  await resetDatabase()
  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(teamspaceMembers)
  await db.delete(teamspaces)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [author, teammate, reader, stranger].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(organizations).values({ id: orgId, name: 'Acme', createdAt: now })

  await db.insert(organizationMembers).values(
    [author, teammate, reader].map((person) => ({
      id: `m-${person.id}`,
      orgId,
      userId: person.id,
      role: 'member' as const,
      createdAt: now,
    })),
  )

  await db.insert(teamspaces).values({
    id: teamspaceId,
    orgId,
    name: 'Engineering',
    access: 'open',
    createdAt: now,
  })

  await db.insert(teamspaceMembers).values(
    [author, teammate].map((person) => ({
      id: `t-${person.id}`,
      teamspaceId,
      userId: person.id,
      createdAt: now,
    })),
  )

  await db.insert(documents).values([
    {
      id: 'dup-parent',
      ownerId: author.id,
      orgId,
      teamspaceId,
      title: 'Handbook',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dup-page',
      ownerId: author.id,
      parentId: 'dup-parent',
      orgId,
      teamspaceId,
      title: 'Onboarding',
      icon: 'https://example.com/icons/book_blue.svg',
      content: '[]',
      createdAt: now,
      updatedAt: now,
    },
  ])
})

describe('duplicateDocument', () => {
  it('keeps the copy beside the source for its owner, with icon', async () => {
    signIn(author)

    const copy = await copyOf(await duplicateDocument('dup-page'))

    expect(copy.ownerId).toBe(author.id)
    expect(copy.parentId).toBe('dup-parent')
    expect(copy.teamspaceId).toBe(teamspaceId)
    expect(copy.icon).toBe('https://example.com/icons/book_blue.svg')
    expect(copy.title).toBe('document.copyTitle')
  })

  it('keeps the copy beside the source for a teamspace editor who did not write it', async () => {
    signIn(teammate)

    const copy = await copyOf(await duplicateDocument('dup-page'))

    expect(copy.ownerId).toBe(teammate.id)
    expect(copy.parentId).toBe('dup-parent')
    expect(copy.teamspaceId).toBe(teamspaceId)
  })

  it('sends the copy to the private pages of someone who can only read it', async () => {
    signIn(reader)

    const copy = await copyOf(await duplicateDocument('dup-page'))

    expect(copy.ownerId).toBe(reader.id)
    expect(copy.parentId).toBeNull()
    expect(copy.teamspaceId).toBeNull()
    expect(copy.orgId).toBeNull()
    expect(copy.orgAccess).toBeNull()
  })

  it('refuses someone without access', async () => {
    signIn(stranger)

    const result = await duplicateDocument('dup-page')

    expect(result).toEqual({ ok: false, error: 'errors.notAllowed' })
  })
})

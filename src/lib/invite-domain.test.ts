import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    return (key: string, values?: Record<string, unknown>) =>
      values
        ? `${namespace}.${key}:${JSON.stringify(values)}`
        : `${namespace}.${key}`
  },
}))

const cookieJar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    delete: (name: string) => {
      cookieJar.delete(name)
    },
    get: (name: string) => {
      const value = cookieJar.get(name)

      return value === undefined ? undefined : { name, value }
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
  }),
}))

const activeSession = { user: { id: 'user-owner', email: 'owner@example.com' } }

vi.mock('@/lib/auth', () => ({
  getSession: async () => activeSession,
}))

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationInvites,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { activeOrgCookie } from '@/lib/active-org'
import { resetInviteLimiter } from '@/lib/authz'
import { inviteToOrganization } from '@/lib/org-actions'
import { inviteToDocument } from '@/lib/share-actions'

const orgId = 'org-acme'
const documentId = 'doc-restricted'

function restrict(domains: string | null) {
  if (domains === null) {
    delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
    return
  }

  process.env.LEAF_ALLOWED_EMAIL_DOMAINS = domains
}

beforeEach(async () => {
  await resetDatabase()
  resetInviteLimiter()
  restrict(null)

  cookieJar.clear()
  cookieJar.set(activeOrgCookie, orgId)

  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(organizationInvites)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values({
    id: activeSession.user.id,
    name: 'Owner',
    email: activeSession.user.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  await db
    .insert(organizations)
    .values({ id: orgId, name: 'Acme School', createdAt: now })

  await db.insert(organizationMembers).values({
    id: 'member-owner',
    orgId,
    userId: activeSession.user.id,
    role: 'owner',
    createdAt: now,
  })

  await db.insert(documents).values({
    id: documentId,
    ownerId: activeSession.user.id,
    title: 'Restricted document',
    content: null,
    publicToken: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
})

afterAll(() => {
  restrict(null)
})

describe('organization invite', () => {
  it('accepts any email without an active restriction', async () => {
    const result = await inviteToOrganization('outside@gmail.com', 'member')

    expect(result.ok).toBe(true)
    expect(await db.select().from(organizationInvites)).toHaveLength(1)
  })

  it('blocks an email outside the domain with an active restriction', async () => {
    restrict('example.com')

    const result = await inviteToOrganization('outside@gmail.com', 'member')

    expect(result).toEqual({
      ok: false,
      error: 'org.errorDomainRestricted:{"domain":"example.com"}',
    })
    expect(await db.select().from(organizationInvites)).toHaveLength(0)
  })

  it('accepts an email from the allowed domain', async () => {
    restrict('example.com')

    const result = await inviteToOrganization('guest@example.com', 'member')

    expect(result.ok).toBe(true)
    expect(await db.select().from(organizationInvites)).toHaveLength(1)
  })

  it('accepts any domain from the list', async () => {
    restrict('example.com,example.dev')

    expect((await inviteToOrganization('one@example.dev', 'member')).ok).toBe(
      true,
    )
    expect((await inviteToOrganization('other@nope.com', 'member')).ok).toBe(
      false,
    )
    expect(await db.select().from(organizationInvites)).toHaveLength(1)
  })
})

describe('document sharing', () => {
  it('accepts any email without an active restriction', async () => {
    const result = await inviteToDocument(documentId, 'outside@gmail.com', 'editor')

    expect(result.ok).toBe(true)
    expect(await db.select().from(documentShares)).toHaveLength(1)
  })

  it('blocks an email outside the domain with an active restriction', async () => {
    restrict('example.com')

    const result = await inviteToDocument(documentId, 'outside@gmail.com', 'editor')

    expect(result).toEqual({
      ok: false,
      error: 'errors.domainRestricted:{"domain":"example.com"}',
    })
    expect(await db.select().from(documentShares)).toHaveLength(0)
  })

  it('accepts a guest from the domain who is not in the organization', async () => {
    restrict('example.com')

    const result = await inviteToDocument(
      documentId,
      'GUEST@Example.com',
      'editor',
    )

    expect(result.ok).toBe(true)

    const shares = await db.select().from(documentShares)

    expect(shares).toHaveLength(1)
    expect(shares[0].granteeEmail).toBe('guest@example.com')
  })
})

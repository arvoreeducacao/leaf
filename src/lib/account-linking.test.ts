import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { handleOAuthUserInfo } from 'better-auth/oauth2'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { account, documents, session, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { auth } from '@/lib/auth'

const email = 'person@example.com'

async function endpointContext() {
  return {
    context: await auth.$context,
    setCookie: () => undefined,
    getCookie: () => undefined,
    setSignedCookie: async () => undefined,
    getSignedCookie: async () => undefined,
    headers: new Headers(),
    query: {},
    body: {},
    redirect: (url: string) => new Response(null, { status: 302 }),
    json: (value: unknown) => value,
    path: '/callback/sso',
    method: 'GET',
  }
}

async function ssoSignIn() {
  const context = await endpointContext()

  return handleOAuthUserInfo(context as never, {
    account: {
      accountId: 'sso-identity-id',
      issuer: 'https://auth.example.com/oidc',
      providerId: 'sso',
    },
    userInfo: {
      email,
      emailVerified: true,
      id: 'sso-identity-id',
      name: 'Person from Acme',
    },
  })
}

beforeEach(async () => {
  await resetDatabase()

  process.env.BETTER_AUTH_SECRET ??= 'leaf-test-secret-with-thirty-two-chars'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
})

describe('linking the SSO account to the email and password account', () => {
  it('refuses to absorb a password account that never proved the email', async () => {
    const created = await auth.api.signUpEmail({
      body: { email, name: 'Person', password: 'strong-password-123' },
    })

    await db.insert(documents).values({
      id: 'doc-old',
      ownerId: created.user.id,
      title: 'Old document',
    })

    const linked = await ssoSignIn()

    expect(linked.error).toBe('account not linked')
    expect(await db.select().from(user)).toHaveLength(1)

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, created.user.id))

    expect(accounts.map((row) => row.providerId)).toEqual(['credential'])

    const owned = await db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, created.user.id))

    expect(owned).toHaveLength(1)
    expect(owned[0]?.title).toBe('Old document')
  })

  it('creates the person on the first sign-in through SSO', async () => {
    const registered = await ssoSignIn()

    expect(registered.error).toBeNull()
    expect(registered.isRegister).toBe(true)

    const people = await db.select().from(user)

    expect(people).toHaveLength(1)
    expect(people[0]?.email).toBe(email)

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, people[0]!.id))

    expect(sessions).toHaveLength(1)
  })
})

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { account, session, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'

const password = 'strong-password-123'

async function loadAuth(withSso: boolean) {
  vi.resetModules()
  delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS

  if (withSso) {
    process.env.LEAF_SSO_CLIENT_ID = 'leaf-client'
    process.env.LEAF_SSO_ISSUER = 'https://sso.example.com'
  } else {
    delete process.env.LEAF_SSO_CLIENT_ID
    delete process.env.LEAF_SSO_ISSUER
  }

  return (await import('@/lib/auth')).auth
}

type AuthInstance = Awaited<ReturnType<typeof loadAuth>>

function signUp(auth: AuthInstance, email: string) {
  return auth.api.signUpEmail({
    body: { email, name: email.split('@')[0], password },
  })
}

function signIn(auth: AuthInstance, email: string) {
  return auth.api.signInEmail({ body: { email, password } })
}

beforeEach(async () => {
  await resetDatabase()
  await db.delete(session)
  await db.delete(account)
  await db.delete(user)

  process.env.BETTER_AUTH_SECRET ??= 'leaf-test-secret-with-thirty-two-chars'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
})

afterAll(() => {
  delete process.env.LEAF_SSO_CLIENT_ID
  delete process.env.LEAF_SSO_ISSUER
})

describe('email and password with SSO configured', () => {
  it('rejects the password sign-in of an account created before SSO', async () => {
    const open = await loadAuth(false)

    await signUp(open, 'person@example.com')
    await db.delete(session)

    const withSso = await loadAuth(true)

    await expect(signIn(withSso, 'person@example.com')).rejects.toBeTruthy()

    expect(await db.select().from(session)).toHaveLength(0)
  })

  it('rejects the password sign-up', async () => {
    const withSso = await loadAuth(true)

    await expect(signUp(withSso, 'person@example.com')).rejects.toBeTruthy()

    expect(await db.select().from(user)).toHaveLength(0)
  })
})

describe('email and password without SSO', () => {
  it('keeps the password sign-up and sign-in', async () => {
    const open = await loadAuth(false)

    const created = await signUp(open, 'person@example.com')

    expect(created.user.email).toBe('person@example.com')
    expect(await signIn(open, 'person@example.com')).toBeTruthy()
  })
})

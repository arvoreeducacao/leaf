import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { handleOAuthUserInfo } from 'better-auth/oauth2'

import { db } from '@/db'
import { account, session, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { emailDomainErrorCode } from '@/lib/email-domain'

async function loadAuth(domains: string | null) {
  vi.resetModules()

  if (domains === null) {
    delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
  } else {
    process.env.LEAF_ALLOWED_EMAIL_DOMAINS = domains
  }

  return (await import('@/lib/auth')).auth
}

type AuthInstance = Awaited<ReturnType<typeof loadAuth>>

async function signUp(auth: AuthInstance, email: string) {
  return auth.api.signUpEmail({
    body: { email, name: email.split('@')[0], password: 'strong-password-123' },
  })
}

async function signIn(auth: AuthInstance, email: string) {
  return auth.api.signInEmail({
    body: { email, password: 'strong-password-123' },
  })
}

async function ssoSignIn(auth: AuthInstance, email: string) {
  const context = {
    body: {},
    context: await auth.$context,
    getCookie: () => undefined,
    getSignedCookie: async () => undefined,
    headers: new Headers(),
    json: (value: unknown) => value,
    method: 'GET',
    path: '/callback/arvore',
    query: {},
    redirect: () => new Response(null, { status: 302 }),
    setCookie: () => undefined,
    setSignedCookie: async () => undefined,
  }

  return handleOAuthUserInfo(context as never, {
    account: {
      accountId: `identity-${email}`,
      issuer: 'https://auth.arvore.com.br/api-arvore',
      providerId: 'arvore',
    },
    userInfo: {
      email,
      emailVerified: true,
      id: `identity-${email}`,
      name: email.split('@')[0],
    },
  })
}

async function expectDomainRejection(action: Promise<unknown>) {
  await expect(action).rejects.toMatchObject({
    body: { code: emailDomainErrorCode },
  })
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
  delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
})

describe('domain restriction off', () => {
  it('lets an account be created with any email', async () => {
    const auth = await loadAuth(null)

    const created = await signUp(auth, 'person@gmail.com')

    expect(created.user.email).toBe('person@gmail.com')
    expect(await signIn(auth, 'person@gmail.com')).toBeTruthy()
  })
})

describe('domain restriction on', () => {
  it('lets an account be created and signed in with the allowed domain', async () => {
    const auth = await loadAuth('arvore.com.br')

    const created = await signUp(auth, 'person@arvore.com.br')

    expect(created.user.email).toBe('person@arvore.com.br')
    expect(await signIn(auth, 'person@arvore.com.br')).toBeTruthy()
  })

  it('accepts the domain in any case', async () => {
    const auth = await loadAuth('arvore.com.br')

    const created = await signUp(auth, 'Person@ARVORE.COM.BR')

    expect(created.user.email).toBe('person@arvore.com.br')
  })

  it('rejects the sign-up of an email outside the domain', async () => {
    const auth = await loadAuth('arvore.com.br')

    await expectDomainRejection(signUp(auth, 'person@gmail.com'))

    expect(await db.select().from(user)).toHaveLength(0)
  })

  it('rejects the sign-in of an account created before the restriction', async () => {
    const open = await loadAuth(null)

    await signUp(open, 'old@gmail.com')
    await db.delete(session)

    const restricted = await loadAuth('arvore.com.br')

    await expectDomainRejection(signIn(restricted, 'old@gmail.com'))

    expect(await db.select().from(session)).toHaveLength(0)
  })

  it('accepts any domain from the list and rejects the ones outside', async () => {
    const auth = await loadAuth('arvore.com.br, arvore.dev')

    expect((await signUp(auth, 'one@arvore.com.br')).user.email).toBe(
      'one@arvore.com.br',
    )
    expect((await signUp(auth, 'two@arvore.dev')).user.email).toBe(
      'two@arvore.dev',
    )

    await expectDomainRejection(signUp(auth, 'three@arvore.com'))
  })

  it('rejects a subdomain of the allowed domain', async () => {
    const auth = await loadAuth('arvore.com.br')

    await expectDomainRejection(signUp(auth, 'person@mail.arvore.com.br'))
  })

  it('lets the SSO account of the allowed domain sign in', async () => {
    const auth = await loadAuth('arvore.com.br')

    const signedIn = await ssoSignIn(auth, 'person@arvore.com.br')

    expect(signedIn.error).toBeNull()
    expect(signedIn.data?.user.email).toBe('person@arvore.com.br')
    expect(await db.select().from(session)).toHaveLength(1)
  })

  it('rejects the SSO account outside the domain', async () => {
    const auth = await loadAuth('arvore.com.br')

    await expectDomainRejection(ssoSignIn(auth, 'person@gmail.com'))

    expect(await db.select().from(user)).toHaveLength(0)
    expect(await db.select().from(session)).toHaveLength(0)
  })
})

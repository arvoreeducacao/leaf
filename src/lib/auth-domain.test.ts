import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

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
    body: { email, name: email.split('@')[0], password: 'senha-forte-123' },
  })
}

async function signIn(auth: AuthInstance, email: string) {
  return auth.api.signInEmail({
    body: { email, password: 'senha-forte-123' },
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

  process.env.BETTER_AUTH_SECRET ??= 'leaf-test-secret-de-trinta-e-dois-chars'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
})

afterAll(() => {
  delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
})

describe('restrição de domínio desligada', () => {
  it('deixa criar conta com qualquer email', async () => {
    const auth = await loadAuth(null)

    const created = await signUp(auth, 'pessoa@gmail.com')

    expect(created.user.email).toBe('pessoa@gmail.com')
    expect(await signIn(auth, 'pessoa@gmail.com')).toBeTruthy()
  })
})

describe('restrição de domínio ligada', () => {
  it('deixa criar conta e entrar com o domínio permitido', async () => {
    const auth = await loadAuth('arvore.com.br')

    const created = await signUp(auth, 'pessoa@arvore.com.br')

    expect(created.user.email).toBe('pessoa@arvore.com.br')
    expect(await signIn(auth, 'pessoa@arvore.com.br')).toBeTruthy()
  })

  it('aceita o domínio em qualquer caixa', async () => {
    const auth = await loadAuth('arvore.com.br')

    const created = await signUp(auth, 'Pessoa@ARVORE.COM.BR')

    expect(created.user.email).toBe('pessoa@arvore.com.br')
  })

  it('recusa o cadastro de email fora do domínio', async () => {
    const auth = await loadAuth('arvore.com.br')

    await expectDomainRejection(signUp(auth, 'pessoa@gmail.com'))

    expect(await db.select().from(user)).toHaveLength(0)
  })

  it('recusa o login de conta criada antes da restrição', async () => {
    const aberto = await loadAuth(null)

    await signUp(aberto, 'antiga@gmail.com')
    await db.delete(session)

    const restrito = await loadAuth('arvore.com.br')

    await expectDomainRejection(signIn(restrito, 'antiga@gmail.com'))

    expect(await db.select().from(session)).toHaveLength(0)
  })

  it('aceita qualquer domínio da lista e recusa os de fora', async () => {
    const auth = await loadAuth('arvore.com.br, arvore.dev')

    expect((await signUp(auth, 'um@arvore.com.br')).user.email).toBe(
      'um@arvore.com.br',
    )
    expect((await signUp(auth, 'dois@arvore.dev')).user.email).toBe(
      'dois@arvore.dev',
    )

    await expectDomainRejection(signUp(auth, 'tres@arvore.com'))
  })

  it('recusa subdomínio do domínio permitido', async () => {
    const auth = await loadAuth('arvore.com.br')

    await expectDomainRejection(signUp(auth, 'pessoa@mail.arvore.com.br'))
  })
})

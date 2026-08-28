import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('@/db/schema')

  const sqlite = new Database(':memory:')
  const folder = join(process.cwd(), 'drizzle')
  const files = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const contents = readFileSync(join(folder, file), 'utf8')

    for (const statement of contents.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()

      if (trimmed.length > 0) {
        sqlite.exec(trimmed)
      }
    }
  }

  return { db: drizzle(sqlite, { schema }), schema }
})

import { db } from '@/db'
import { documentShares, documents, user } from '@/db/schema'
import {
  canEdit,
  canManageShares,
  getDocumentAccess,
  getTrashedDocumentAccess,
  isPublicTokenShaped,
  lookupPublicDocument,
  registerPublicLookupAttempt,
  resetPublicLookupLimiter,
} from '@/lib/authz'

const owner = { id: 'user-owner', email: 'dono@arvore.com.br' }
const editor = { id: 'user-editor', email: 'editor@arvore.com.br' }
const viewer = { id: 'user-viewer', email: 'leitor@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'fora@arvore.com.br' }

const liveToken = 'kQ4nPz7bLxRfT2aWmC9uVhJ8'
const trashedToken = 'Zt6yBn3kQwEr8sDf1gHj5LpM'

function sessionFor(person: { id: string; email: string }) {
  return { user: person }
}

beforeEach(async () => {
  resetPublicLookupLimiter()

  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [owner, editor, viewer, stranger].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(documents).values([
    {
      id: 'doc-live',
      ownerId: owner.id,
      title: 'Documento vivo',
      content: null,
      publicToken: liveToken,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'doc-private',
      ownerId: owner.id,
      title: 'Documento privado',
      content: null,
      publicToken: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'doc-trashed',
      ownerId: owner.id,
      title: 'Documento na lixeira',
      content: null,
      publicToken: trashedToken,
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
  ])

  await db.insert(documentShares).values([
    {
      id: 'share-editor',
      documentId: 'doc-live',
      granteeEmail: editor.email,
      role: 'editor',
      createdAt: now,
    },
    {
      id: 'share-viewer',
      documentId: 'doc-live',
      granteeEmail: viewer.email,
      role: 'viewer',
      createdAt: now,
    },
  ])
})

describe('getDocumentAccess', () => {
  it('reconhece o dono', async () => {
    await expect(getDocumentAccess('doc-live', sessionFor(owner))).resolves.toBe(
      'owner',
    )
  })

  it('reconhece convidado editor', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(editor)),
    ).resolves.toBe('editor')
  })

  it('reconhece convidado leitor', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(viewer)),
    ).resolves.toBe('viewer')
  })

  it('resolve o convite ignorando caixa do email', async () => {
    await expect(
      getDocumentAccess('doc-live', {
        user: { id: editor.id, email: editor.email.toUpperCase() },
      }),
    ).resolves.toBe('editor')
  })

  it('nega quem não foi convidado', async () => {
    await expect(
      getDocumentAccess('doc-live', sessionFor(stranger)),
    ).resolves.toBeNull()
  })

  it('nega visitante sem sessão', async () => {
    await expect(getDocumentAccess('doc-live', null)).resolves.toBeNull()
  })

  it('nega documento na lixeira mesmo para o dono', async () => {
    await expect(
      getDocumentAccess('doc-trashed', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('nega documento inexistente', async () => {
    await expect(
      getDocumentAccess('doc-ausente', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('não vaza acesso de um documento para outro', async () => {
    await expect(
      getDocumentAccess('doc-private', sessionFor(editor)),
    ).resolves.toBeNull()
  })
})

describe('getTrashedDocumentAccess', () => {
  it('libera o dono', async () => {
    await expect(
      getTrashedDocumentAccess('doc-trashed', sessionFor(owner)),
    ).resolves.toBe('owner')
  })

  it('nega convidado', async () => {
    await expect(
      getTrashedDocumentAccess('doc-trashed', sessionFor(editor)),
    ).resolves.toBeNull()
  })
})

describe('hierarquia de papéis', () => {
  it('canEdit vale para dono e editor', () => {
    expect(canEdit('owner')).toBe(true)
    expect(canEdit('editor')).toBe(true)
    expect(canEdit('viewer')).toBe(false)
    expect(canEdit(null)).toBe(false)
  })

  it('canManageShares vale só para o dono', () => {
    expect(canManageShares('owner')).toBe(true)
    expect(canManageShares('editor')).toBe(false)
    expect(canManageShares('viewer')).toBe(false)
    expect(canManageShares(null)).toBe(false)
  })
})

describe('link público', () => {
  it('aceita token válido', async () => {
    const result = await lookupPublicDocument(liveToken, 'ip-1')

    expect(result.status).toBe('ok')
    expect(result.status === 'ok' && result.document.id).toBe('doc-live')
  })

  it('recusa token de documento na lixeira', async () => {
    const result = await lookupPublicDocument(trashedToken, 'ip-1')

    expect(result.status).toBe('not-found')
  })

  it('recusa token revogado', async () => {
    await db
      .update(documents)
      .set({ publicToken: null })
      .where(eq(documents.id, 'doc-live'))

    const result = await lookupPublicDocument(liveToken, 'ip-1')

    expect(result.status).toBe('not-found')
  })

  it('recusa token com formato inválido sem consultar o banco', async () => {
    expect(isPublicTokenShaped('curto')).toBe(false)
    expect(isPublicTokenShaped("' OR 1=1 --")).toBe(false)
    expect(isPublicTokenShaped(liveToken)).toBe(true)

    const result = await lookupPublicDocument('curto', 'ip-1')

    expect(result.status).toBe('not-found')
  })
})

describe('rate limit do lookup público', () => {
  it('bloqueia depois de 30 tentativas na mesma janela', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(registerPublicLookupAttempt('ip-flood', now).allowed).toBe(true)
    }

    const blocked = registerPublicLookupAttempt('ip-flood', now)

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('não penaliza outra origem', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-flood', now)
    }

    expect(registerPublicLookupAttempt('ip-outro', now).allowed).toBe(true)
  })

  it('libera de novo depois da janela', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-flood', now)
    }

    expect(registerPublicLookupAttempt('ip-flood', now).allowed).toBe(false)
    expect(
      registerPublicLookupAttempt('ip-flood', now + 61_000).allowed,
    ).toBe(true)
  })

  it('devolve rate-limited no lookup quando a janela estoura', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      registerPublicLookupAttempt('ip-lookup')
    }

    const result = await lookupPublicDocument(liveToken, 'ip-lookup')

    expect(result.status).toBe('rate-limited')
  })
})

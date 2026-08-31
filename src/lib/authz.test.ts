import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

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
import {
  atLeast,
  canComment,
  canEdit,
  canManageShares,
  getDocumentAccess,
  getTrashedDocumentAccess,
  isPublicTokenShaped,
  lookupPublicDocument,
  registerInviteAttempt,
  registerPublicLookupAttempt,
  resetInviteLimiter,
  resetPublicLookupLimiter,
} from '@/lib/authz'
import {
  acceptPendingInvites,
  canManageOrganization,
  detachMemberDocuments,
  getMembership,
  listOrganizationDocuments,
  listOrganizationEmails,
  otherOwnersInOrganization,
} from '@/lib/organizations'

const owner = { id: 'user-owner', email: 'dono@arvore.com.br' }
const editor = { id: 'user-editor', email: 'editor@arvore.com.br' }
const viewer = { id: 'user-viewer', email: 'leitor@arvore.com.br' }
const stranger = { id: 'user-stranger', email: 'fora@arvore.com.br' }
const orgAdmin = { id: 'user-org-admin', email: 'admin@arvore.com.br' }
const orgMember = { id: 'user-org-member', email: 'membro@arvore.com.br' }
const outsider = { id: 'user-outsider', email: 'externo@outraescola.com.br' }

const liveToken = 'kQ4nPz7bLxRfT2aWmC9uVhJ8'
const trashedToken = 'Zt6yBn3kQwEr8sDf1gHj5LpM'

function sessionFor(person: { id: string; email: string }) {
  return { user: person }
}

const mainOrg = 'org-arvore'
const otherOrg = 'org-outra-escola'

beforeEach(async () => {
  await resetDatabase()
  resetPublicLookupLimiter()
  resetInviteLimiter()

  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(organizationInvites)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [owner, editor, viewer, stranger, orgAdmin, orgMember, outsider].map(
      (person) => ({
        id: person.id,
        name: person.email,
        email: person.email,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  )

  await db.insert(organizations).values([
    { id: mainOrg, name: 'Escola Árvore', createdAt: now },
    { id: otherOrg, name: 'Outra Escola', createdAt: now },
  ])

  await db.insert(organizationMembers).values([
    {
      id: 'member-owner',
      orgId: mainOrg,
      userId: owner.id,
      role: 'owner',
      createdAt: now,
    },
    {
      id: 'member-admin',
      orgId: mainOrg,
      userId: orgAdmin.id,
      role: 'admin',
      createdAt: now,
    },
    {
      id: 'member-member',
      orgId: mainOrg,
      userId: orgMember.id,
      role: 'member',
      createdAt: now,
    },
    {
      id: 'member-outsider',
      orgId: otherOrg,
      userId: outsider.id,
      role: 'owner',
      createdAt: now,
    },
  ])

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
    {
      id: 'doc-org-private',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: null,
      title: 'Rascunho do membro',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-viewer',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'viewer',
      title: 'Plano de aula',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-editor',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'editor',
      title: 'Ata da reunião',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-trashed',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'editor',
      title: 'Ata antiga',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
    {
      id: 'doc-other-org',
      ownerId: outsider.id,
      orgId: otherOrg,
      orgAccess: 'editor',
      title: 'Documento da outra escola',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-org-commenter',
      ownerId: orgMember.id,
      orgId: mainOrg,
      orgAccess: 'commenter',
      title: 'Proposta em revisão',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-commenter',
      ownerId: owner.id,
      title: 'Documento com revisor',
      createdAt: now,
      updatedAt: now,
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
    {
      id: 'share-org-downgrade',
      documentId: 'doc-org-editor',
      granteeEmail: orgAdmin.email,
      role: 'viewer',
      createdAt: now,
    },
    {
      id: 'share-guest',
      documentId: 'doc-org-private',
      granteeEmail: outsider.email,
      role: 'viewer',
      createdAt: now,
    },
    {
      id: 'share-commenter',
      documentId: 'doc-commenter',
      granteeEmail: viewer.email,
      role: 'commenter',
      createdAt: now,
    },
    {
      id: 'share-org-commenter-upgrade',
      documentId: 'doc-org-commenter',
      granteeEmail: orgAdmin.email,
      role: 'editor',
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

  it('reconhece convidado com papel de comentar', async () => {
    await expect(
      getDocumentAccess('doc-commenter', sessionFor(viewer)),
    ).resolves.toBe('commenter')
    await expect(
      getDocumentAccess('doc-commenter', sessionFor(editor)),
    ).resolves.toBeNull()
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
    expect(canEdit('commenter')).toBe(false)
    expect(canEdit('viewer')).toBe(false)
    expect(canEdit(null)).toBe(false)
  })

  it('canComment vale de commenter para cima', () => {
    expect(canComment('owner')).toBe(true)
    expect(canComment('editor')).toBe(true)
    expect(canComment('commenter')).toBe(true)
    expect(canComment('viewer')).toBe(false)
    expect(canComment(null)).toBe(false)
  })

  it('a precedência é viewer < commenter < editor < owner', () => {
    expect(atLeast('commenter', 'viewer')).toBe(true)
    expect(atLeast('viewer', 'commenter')).toBe(false)
    expect(atLeast('editor', 'commenter')).toBe(true)
    expect(atLeast('commenter', 'editor')).toBe(false)
    expect(atLeast('owner', 'editor')).toBe(true)
    expect(atLeast('commenter', 'commenter')).toBe(true)
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

describe('precedência com organização', () => {
  it('membro da org lê documento com org_access viewer', async () => {
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })

  it('membro da org edita documento com org_access editor', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(owner)),
    ).resolves.toBe('editor')
  })

  it('admin da org não enxerga documento privado de membro', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('dona da org não enxerga documento privado de membro', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(owner)),
    ).resolves.toBeNull()
  })

  it('dono do documento continua owner mesmo com org_access menor', async () => {
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgMember)),
    ).resolves.toBe('owner')
  })

  it('share explícito vence org_access mais permissivo', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })

  it('convidado externo só alcança o documento compartilhado com ele', async () => {
    await expect(
      getDocumentAccess('doc-org-private', sessionFor(outsider)),
    ).resolves.toBe('viewer')
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('membro de outra org não alcança documento da org alheia', async () => {
    await expect(
      getDocumentAccess('doc-other-org', sessionFor(orgMember)),
    ).resolves.toBeNull()
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('usuário sem organização nenhuma não alcança documento de org', async () => {
    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(stranger)),
    ).resolves.toBeNull()
  })

  it('documento na lixeira não volta pelo org_access', async () => {
    await expect(
      getDocumentAccess('doc-org-trashed', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('documento sem org_id ignora a organização de quem pede', async () => {
    await expect(
      getDocumentAccess('doc-private', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })

  it('membro da org comenta documento com org_access commenter', async () => {
    await expect(
      getDocumentAccess('doc-org-commenter', sessionFor(owner)),
    ).resolves.toBe('commenter')
  })

  it('share explícito vence org_access menos permissivo', async () => {
    await expect(
      getDocumentAccess('doc-org-commenter', sessionFor(orgAdmin)),
    ).resolves.toBe('editor')
  })

  it('org_access nulo não dá acesso nem com org_id preenchido', async () => {
    await db
      .update(documents)
      .set({ orgAccess: null })
      .where(eq(documents.id, 'doc-org-viewer'))

    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
  })
})

describe('organizações', () => {
  it('devolve a organização e o papel de cada pessoa', async () => {
    await expect(getMembership(owner.id)).resolves.toMatchObject({
      orgId: mainOrg,
      orgName: 'Escola Árvore',
      role: 'owner',
    })
    await expect(getMembership(orgMember.id)).resolves.toMatchObject({
      role: 'member',
    })
    await expect(getMembership(stranger.id)).resolves.toBeNull()
  })

  it('canManageOrganization vale para dona e admin', () => {
    expect(canManageOrganization('owner')).toBe(true)
    expect(canManageOrganization('admin')).toBe(true)
    expect(canManageOrganization('member')).toBe(false)
    expect(canManageOrganization(null)).toBe(false)
  })

  it('lista os emails da organização em caixa baixa', async () => {
    const emails = await listOrganizationEmails(mainOrg)

    expect(emails).toEqual(
      expect.arrayContaining([owner.email, orgAdmin.email, orgMember.email]),
    )
    expect(emails).not.toContain(outsider.email)
  })

  it('lista só os documentos da org que não são privados nem da lixeira', async () => {
    const list = await listOrganizationDocuments(mainOrg)
    const ids = list.map((item) => item.id)

    expect(ids).toEqual(
      expect.arrayContaining(['doc-org-viewer', 'doc-org-editor']),
    )
    expect(ids).not.toContain('doc-org-private')
    expect(ids).not.toContain('doc-org-trashed')
    expect(ids).not.toContain('doc-other-org')
  })

  it('conta as outras pessoas donas da organização', async () => {
    await expect(otherOwnersInOrganization(mainOrg, owner.id)).resolves.toBe(0)
    await expect(otherOwnersInOrganization(mainOrg, orgMember.id)).resolves.toBe(
      1,
    )
  })

  it('sair da org devolve os documentos da pessoa para privado', async () => {
    await detachMemberDocuments(mainOrg, orgMember.id)

    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgAdmin)),
    ).resolves.toBeNull()
    await expect(
      getDocumentAccess('doc-org-viewer', sessionFor(orgMember)),
    ).resolves.toBe('owner')
  })

  it('sair da org não mexe no share explícito que a pessoa já tinha dado', async () => {
    await detachMemberDocuments(mainOrg, orgMember.id)

    await expect(
      getDocumentAccess('doc-org-editor', sessionFor(orgAdmin)),
    ).resolves.toBe('viewer')
  })
})

describe('convites de organização', () => {
  it('transforma o convite em participação no primeiro acesso', async () => {
    await db.insert(organizationInvites).values({
      id: 'invite-1',
      orgId: mainOrg,
      email: stranger.email,
      role: 'admin',
      createdAt: new Date(),
    })

    await expect(
      acceptPendingInvites(stranger.id, stranger.email.toUpperCase()),
    ).resolves.toMatchObject([{ orgId: mainOrg, role: 'admin' }])

    const remaining = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, 'invite-1'),
    })

    expect(remaining).toBeUndefined()
  })

  it('quem já tem organização entra também na segunda', async () => {
    await db.insert(organizationInvites).values({
      id: 'invite-2',
      orgId: otherOrg,
      email: orgMember.email,
      role: 'admin',
      createdAt: new Date(),
    })

    const memberships = await acceptPendingInvites(
      orgMember.id,
      orgMember.email,
    )

    expect(memberships.map((item) => item.orgId).sort()).toEqual(
      [mainOrg, otherOrg].sort(),
    )

    const remaining = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.id, 'invite-2'),
    })

    expect(remaining).toBeUndefined()
  })

  it('sem convite, o acesso não cria organização nenhuma', async () => {
    await expect(
      acceptPendingInvites(stranger.id, stranger.email),
    ).resolves.toEqual([])
  })

  it('limita a rajada de convites por pessoa', () => {
    const now = Date.now()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(registerInviteAttempt('org:pessoa', now).allowed).toBe(true)
    }

    expect(registerInviteAttempt('org:pessoa', now).allowed).toBe(false)
    expect(registerInviteAttempt('org:outra-pessoa', now).allowed).toBe(true)
  })
})

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

const activeSession = { user: { id: 'user-owner', email: 'dono@arvore.com.br' } }

vi.mock('@/lib/auth', () => ({
  getSession: async () => activeSession,
}))

import { db } from '@/db'
import {
  documents,
  organizationMembers,
  organizations,
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { activeOrgCookie } from '@/lib/active-org'
import {
  destinationOfParent,
  parseImportDestination,
  resolveImportPlacement,
  serializeImportDestination,
} from '@/lib/import-destination'
import { moveDocument } from '@/lib/document-actions'
import { setOrganizationAccess } from '@/lib/share-actions'

const orgId = 'org-arvore'
const otherOrgId = 'org-outra'
const openTeamspace = 'ts-aberto'
const closedTeamspace = 'ts-fechado'
const foreignTeamspace = 'ts-de-outra-org'
const ownerId = activeSession.user.id

async function seedDocument(
  id: string,
  values: Partial<{
    parentId: string | null
    orgId: string | null
    teamspaceId: string | null
    orgAccess: 'viewer' | 'commenter' | 'editor' | null
  }> = {},
) {
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId,
    title: id,
    parentId: values.parentId ?? null,
    orgId: values.orgId ?? null,
    teamspaceId: values.teamspaceId ?? null,
    orgAccess: values.orgAccess ?? null,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  await resetDatabase()
  cookieJar.clear()
  cookieJar.set(activeOrgCookie, orgId)

  const now = new Date()

  await db.insert(user).values({
    id: ownerId,
    name: 'Dono',
    email: activeSession.user.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(organizations).values([
    { id: orgId, name: 'Escola Árvore', createdAt: now },
    { id: otherOrgId, name: 'Outra escola', createdAt: now },
  ])

  await db.insert(organizationMembers).values({
    id: 'member-owner',
    orgId,
    userId: ownerId,
    role: 'member',
    createdAt: now,
  })

  await db.insert(teamspaces).values([
    { id: openTeamspace, orgId, name: 'Aberto', access: 'open', createdAt: now },
    {
      id: closedTeamspace,
      orgId,
      name: 'Fechado',
      access: 'closed',
      createdAt: now,
    },
    {
      id: foreignTeamspace,
      orgId: otherOrgId,
      name: 'De fora',
      access: 'open',
      createdAt: now,
    },
  ])
})

describe('destino da importação', () => {
  it('lê e escreve o destino que veio do formulário', () => {
    expect(parseImportDestination('private')).toEqual({ kind: 'private' })
    expect(parseImportDestination('organization')).toEqual({
      kind: 'organization',
    })
    expect(parseImportDestination(`teamspace:${openTeamspace}`)).toEqual({
      kind: 'teamspace',
      teamspaceId: openTeamspace,
    })
    expect(
      serializeImportDestination({
        kind: 'teamspace',
        teamspaceId: openTeamspace,
      }),
    ).toBe(`teamspace:${openTeamspace}`)
  })

  it('recusa destino desconhecido e teamspace sem id', () => {
    expect(parseImportDestination('outro')).toBeNull()
    expect(parseImportDestination('teamspace:')).toBeNull()
    expect(parseImportDestination(null)).toBeNull()
  })

  it('herda o destino da página onde a importação começou', () => {
    expect(
      destinationOfParent({
        orgId,
        teamspaceId: openTeamspace,
        orgAccess: null,
      }),
    ).toEqual({ kind: 'teamspace', teamspaceId: openTeamspace })

    expect(
      destinationOfParent({ orgId, teamspaceId: null, orgAccess: 'editor' }),
    ).toEqual({ kind: 'organization' })

    expect(
      destinationOfParent({ orgId, teamspaceId: null, orgAccess: null }),
    ).toEqual({ kind: 'private' })
  })

  it('privado não abre acesso para a organização', async () => {
    expect(await resolveImportPlacement({ kind: 'private' }, ownerId)).toEqual({
      orgId,
      teamspaceId: null,
      orgAccess: null,
    })
  })

  it('organização grava o acesso que faz o time enxergar', async () => {
    expect(
      await resolveImportPlacement({ kind: 'organization' }, ownerId),
    ).toEqual({ orgId, teamspaceId: null, orgAccess: 'editor' })
  })

  it('sem organização não dá para importar para a organização', async () => {
    await db.delete(organizationMembers)

    expect(
      await resolveImportPlacement({ kind: 'organization' }, ownerId),
    ).toBeNull()
  })

  it('teamspace aberto aceita quem é da organização', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: openTeamspace },
        ownerId,
      ),
    ).toEqual({ orgId, teamspaceId: openTeamspace, orgAccess: null })
  })

  it('teamspace fechado recusa quem não participa', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: closedTeamspace },
        ownerId,
      ),
    ).toBeNull()
  })

  it('teamspace fechado aceita quem participa', async () => {
    await db.insert(teamspaceMembers).values({
      id: 'ts-member',
      teamspaceId: closedTeamspace,
      userId: ownerId,
      role: 'member',
      createdAt: new Date(),
    })

    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: closedTeamspace },
        ownerId,
      ),
    ).toEqual({ orgId, teamspaceId: closedTeamspace, orgAccess: null })
  })

  it('teamspace de outra organização é recusado mesmo estando aberto', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: foreignTeamspace },
        ownerId,
      ),
    ).toBeNull()
  })
})

describe('mover para dentro de uma página compartilhada', () => {
  it('copia o acesso da organização do pai para a subárvore movida', async () => {
    await seedDocument('destino', { orgId, orgAccess: 'editor' })
    await seedDocument('solta', { orgId })
    await seedDocument('filha-da-solta', { orgId, parentId: 'solta' })

    expect((await moveDocument('solta', 'destino')).ok).toBe(true)

    const rows = await db
      .select({ id: documents.id, orgAccess: documents.orgAccess })
      .from(documents)
    const accessById = new Map(rows.map((row) => [row.id, row.orgAccess]))

    expect(accessById.get('solta')).toBe('editor')
    expect(accessById.get('filha-da-solta')).toBe('editor')
  })

  it('tira o acesso quando o novo pai é privado', async () => {
    await seedDocument('destino-privado', { orgId })
    await seedDocument('compartilhada', { orgId, orgAccess: 'editor' })

    expect(
      (await moveDocument('compartilhada', 'destino-privado')).ok,
    ).toBe(true)

    const moved = await db.query.documents.findFirst({
      where: eq(documents.id, 'compartilhada'),
    })

    expect(moved?.orgAccess).toBeNull()
  })
})

describe('compartilhar com a organização', () => {
  it('desce o acesso para a subárvore inteira', async () => {
    await seedDocument('raiz', { orgId })
    await seedDocument('filha', { orgId, parentId: 'raiz' })
    await seedDocument('neta', { orgId, parentId: 'filha' })
    await seedDocument('outra-arvore', { orgId })

    const result = await setOrganizationAccess('raiz', 'editor')

    expect(result.ok).toBe(true)

    const rows = await db
      .select({ id: documents.id, orgAccess: documents.orgAccess })
      .from(documents)

    const accessById = new Map(rows.map((row) => [row.id, row.orgAccess]))

    expect(accessById.get('raiz')).toBe('editor')
    expect(accessById.get('filha')).toBe('editor')
    expect(accessById.get('neta')).toBe('editor')
    expect(accessById.get('outra-arvore')).toBeNull()
  })

  it('retira o acesso da subárvore inteira', async () => {
    await seedDocument('raiz', { orgId, orgAccess: 'editor' })
    await seedDocument('filha', { orgId, orgAccess: 'editor', parentId: 'raiz' })

    expect((await setOrganizationAccess('raiz', 'none')).ok).toBe(true)

    const filha = await db.query.documents.findFirst({
      where: eq(documents.id, 'filha'),
    })

    expect(filha?.orgAccess).toBeNull()
  })

  it('preenche o org_id da subárvore para o acesso valer', async () => {
    await seedDocument('raiz', { orgId })
    await seedDocument('filha', { parentId: 'raiz' })

    expect((await setOrganizationAccess('raiz', 'viewer')).ok).toBe(true)

    const filha = await db.query.documents.findFirst({
      where: eq(documents.id, 'filha'),
    })

    expect(filha?.orgId).toBe(orgId)
    expect(filha?.orgAccess).toBe('viewer')
  })
})

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

const activeSession = { user: { id: 'user-owner', email: 'owner@arvore.com.br' } }

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
    name: 'Owner',
    email: activeSession.user.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(organizations).values([
    { id: orgId, name: 'Árvore School', createdAt: now },
    { id: otherOrgId, name: 'Other school', createdAt: now },
  ])

  await db.insert(organizationMembers).values({
    id: 'member-owner',
    orgId,
    userId: ownerId,
    role: 'member',
    createdAt: now,
  })

  await db.insert(teamspaces).values([
    { id: openTeamspace, orgId, name: 'Open', access: 'open', createdAt: now },
    {
      id: closedTeamspace,
      orgId,
      name: 'Closed',
      access: 'closed',
      createdAt: now,
    },
    {
      id: foreignTeamspace,
      orgId: otherOrgId,
      name: 'Outsider',
      access: 'open',
      createdAt: now,
    },
  ])
})

describe('import destination', () => {
  it('reads and writes the destination that came from the form', () => {
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

  it('rejects an unknown destination and a teamspace without an id', () => {
    expect(parseImportDestination('outro')).toBeNull()
    expect(parseImportDestination('teamspace:')).toBeNull()
    expect(parseImportDestination(null)).toBeNull()
  })

  it('inherits the destination of the page where the import started', () => {
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

  it('private grants no access to the organization', async () => {
    expect(await resolveImportPlacement({ kind: 'private' }, ownerId)).toEqual({
      orgId,
      teamspaceId: null,
      orgAccess: null,
    })
  })

  it('organization writes the access that lets the team see it', async () => {
    expect(
      await resolveImportPlacement({ kind: 'organization' }, ownerId),
    ).toEqual({ orgId, teamspaceId: null, orgAccess: 'editor' })
  })

  it('without an organization there is no importing into the organization', async () => {
    await db.delete(organizationMembers)

    expect(
      await resolveImportPlacement({ kind: 'organization' }, ownerId),
    ).toBeNull()
  })

  it('an open teamspace accepts whoever is in the organization', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: openTeamspace },
        ownerId,
      ),
    ).toEqual({ orgId, teamspaceId: openTeamspace, orgAccess: null })
  })

  it('a closed teamspace rejects whoever is not part of it', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: closedTeamspace },
        ownerId,
      ),
    ).toBeNull()
  })

  it('a closed teamspace accepts whoever is part of it', async () => {
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

  it('a teamspace of another organization is rejected even when open', async () => {
    expect(
      await resolveImportPlacement(
        { kind: 'teamspace', teamspaceId: foreignTeamspace },
        ownerId,
      ),
    ).toBeNull()
  })
})

describe('moving into a shared page', () => {
  it('copies the organization access of the parent to the moved subtree', async () => {
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

  it('removes the access when the new parent is private', async () => {
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

describe('sharing with the organization', () => {
  it('pushes the access down to the whole subtree', async () => {
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

  it('takes the access away from the whole subtree', async () => {
    await seedDocument('raiz', { orgId, orgAccess: 'editor' })
    await seedDocument('filha', { orgId, orgAccess: 'editor', parentId: 'raiz' })

    expect((await setOrganizationAccess('raiz', 'none')).ok).toBe(true)

    const filha = await db.query.documents.findFirst({
      where: eq(documents.id, 'filha'),
    })

    expect(filha?.orgAccess).toBeNull()
  })

  it('fills in the org_id of the subtree so the access holds', async () => {
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

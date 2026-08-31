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
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { getDocumentAccess } from '@/lib/authz'
import { listPrivateDocuments } from '@/lib/documents'
import {
  acceptPendingInvites,
  listMemberships,
  listOrganizationDocuments,
  resolveMembership,
} from '@/lib/organizations'
import { listVisibleTeamspaces } from '@/lib/teamspaces'

const owner = { id: 'ts-owner', email: 'dono@arvore.com.br' }
const teamMember = { id: 'ts-member', email: 'time@arvore.com.br' }
const orgOnly = { id: 'ts-org-only', email: 'colega@arvore.com.br' }
const outsider = { id: 'ts-outsider', email: 'fora@outraescola.com.br' }

const mainOrg = 'org-arvore'
const otherOrg = 'org-outra'

const openTeamspace = 'ts-open'
const closedTeamspace = 'ts-closed'

function sessionFor(person: { id: string; email: string }) {
  return { user: person }
}

async function insertDocument(
  values: Readonly<{
    id: string
    ownerId: string
    teamspaceId?: string | null
    orgId?: string | null
    orgAccess?: 'viewer' | 'commenter' | 'editor' | null
  }>,
) {
  const now = new Date()

  await db.insert(documents).values({
    id: values.id,
    ownerId: values.ownerId,
    orgId: values.orgId ?? mainOrg,
    orgAccess: values.orgAccess ?? null,
    teamspaceId: values.teamspaceId ?? null,
    title: values.id,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  await resetDatabase()
  await db.delete(documentShares)
  await db.delete(documents)
  await db.delete(teamspaceMembers)
  await db.delete(teamspaces)
  await db.delete(organizationInvites)
  await db.delete(organizationMembers)
  await db.delete(organizations)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [owner, teamMember, orgOnly, outsider].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(organizations).values([
    { id: mainOrg, name: 'Escola Árvore', createdAt: now },
    { id: otherOrg, name: 'Outra Escola', createdAt: now },
  ])

  await db.insert(organizationMembers).values([
    {
      id: 'm-owner',
      orgId: mainOrg,
      userId: owner.id,
      role: 'owner',
      createdAt: now,
    },
    {
      id: 'm-team',
      orgId: mainOrg,
      userId: teamMember.id,
      role: 'member',
      createdAt: now,
    },
    {
      id: 'm-org-only',
      orgId: mainOrg,
      userId: orgOnly.id,
      role: 'member',
      createdAt: now,
    },
    {
      id: 'm-outsider',
      orgId: otherOrg,
      userId: outsider.id,
      role: 'member',
      createdAt: now,
    },
  ])

  await db.insert(teamspaces).values([
    {
      id: openTeamspace,
      orgId: mainOrg,
      name: 'Time aberto',
      access: 'open',
      createdAt: now,
    },
    {
      id: closedTeamspace,
      orgId: mainOrg,
      name: 'Time fechado',
      access: 'closed',
      createdAt: now,
    },
  ])

  await db.insert(teamspaceMembers).values([
    {
      id: 'tm-open',
      teamspaceId: openTeamspace,
      userId: teamMember.id,
      role: 'member',
      createdAt: now,
    },
    {
      id: 'tm-closed',
      teamspaceId: closedTeamspace,
      userId: teamMember.id,
      role: 'owner',
      createdAt: now,
    },
  ])
})

describe('precedência de acesso com teamspaces', () => {
  it('dono do documento vence o teamspace fechado do qual ele não participa', async () => {
    await insertDocument({
      id: 'doc-owner',
      ownerId: owner.id,
      teamspaceId: closedTeamspace,
    })

    await expect(
      getDocumentAccess('doc-owner', sessionFor(owner)),
    ).resolves.toBe('owner')
  })

  it('share explícito vence o teamspace e pode rebaixar o membro', async () => {
    await insertDocument({
      id: 'doc-shared',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await db.insert(documentShares).values({
      id: 'share-1',
      documentId: 'doc-shared',
      granteeEmail: teamMember.email,
      role: 'viewer',
      createdAt: new Date(),
    })

    await expect(
      getDocumentAccess('doc-shared', sessionFor(teamMember)),
    ).resolves.toBe('viewer')
  })

  it('membro do teamspace herda editor', async () => {
    await insertDocument({
      id: 'doc-team',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-team', sessionFor(teamMember)),
    ).resolves.toBe('editor')
  })

  it('teamspace vence org_access: membro do teamspace edita doc com org_access viewer', async () => {
    await insertDocument({
      id: 'doc-team-org',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
      orgAccess: 'viewer',
    })

    await expect(
      getDocumentAccess('doc-team-org', sessionFor(teamMember)),
    ).resolves.toBe('editor')
  })

  it('teamspace aberto deixa qualquer membro da organização ver', async () => {
    await insertDocument({
      id: 'doc-open',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-open', sessionFor(orgOnly)),
    ).resolves.toBe('viewer')
  })

  it('teamspace fechado esconde o documento de quem não foi convidado', async () => {
    await insertDocument({
      id: 'doc-closed',
      ownerId: owner.id,
      teamspaceId: closedTeamspace,
    })

    await expect(
      getDocumentAccess('doc-closed', sessionFor(orgOnly)),
    ).resolves.toBeNull()
  })

  it('org_access continua valendo quando o teamspace não concede nada', async () => {
    await insertDocument({
      id: 'doc-closed-org',
      ownerId: owner.id,
      teamspaceId: closedTeamspace,
      orgAccess: 'editor',
    })

    await expect(
      getDocumentAccess('doc-closed-org', sessionFor(orgOnly)),
    ).resolves.toBe('editor')
  })

  it('quem é de outra organização não alcança teamspace aberto', async () => {
    await insertDocument({
      id: 'doc-open-outsider',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-open-outsider', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('documento sem teamspace segue a precedência anterior', async () => {
    await insertDocument({
      id: 'doc-plain',
      ownerId: owner.id,
      orgAccess: 'commenter',
    })

    await expect(
      getDocumentAccess('doc-plain', sessionFor(teamMember)),
    ).resolves.toBe('commenter')
    await expect(
      getDocumentAccess('doc-plain', sessionFor(outsider)),
    ).resolves.toBeNull()
  })
})

describe('listas da sidebar', () => {
  it('teamspace fechado só aparece para quem participa', async () => {
    await expect(
      listVisibleTeamspaces(mainOrg, teamMember.id),
    ).resolves.toHaveLength(2)

    const visible = await listVisibleTeamspaces(mainOrg, orgOnly.id)

    expect(visible.map((item) => item.id)).toEqual([openTeamspace])
    expect(visible[0].role).toBeNull()
  })

  it('documento de teamspace sai das seções Privado e Organização', async () => {
    await insertDocument({
      id: 'doc-in-team',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
      orgAccess: 'editor',
    })
    await insertDocument({ id: 'doc-private', ownerId: owner.id })

    const privateDocuments = await listPrivateDocuments(owner.id)
    const organizationDocuments = await listOrganizationDocuments(mainOrg)

    expect(privateDocuments.map((item) => item.id)).toEqual(['doc-private'])
    expect(organizationDocuments).toHaveLength(0)
  })
})

describe('múltiplas organizações', () => {
  it('a pessoa entra em todas as organizações que a convidaram', async () => {
    await db.insert(organizationInvites).values([
      {
        id: 'invite-1',
        orgId: mainOrg,
        email: 'nova@arvore.com.br',
        role: 'member',
        createdAt: new Date(),
      },
      {
        id: 'invite-2',
        orgId: otherOrg,
        email: 'nova@arvore.com.br',
        role: 'admin',
        createdAt: new Date(),
      },
    ])

    const now = new Date()

    await db.insert(user).values({
      id: 'ts-newcomer',
      name: 'nova',
      email: 'nova@arvore.com.br',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })

    const memberships = await acceptPendingInvites(
      'ts-newcomer',
      'nova@arvore.com.br',
    )

    expect(memberships.map((item) => item.orgId).sort()).toEqual(
      [mainOrg, otherOrg].sort(),
    )
    await expect(listMemberships('ts-newcomer')).resolves.toHaveLength(2)
  })

  it('a organização ativa vem do id preferido e cai na primeira quando ele não vale', async () => {
    const now = new Date()

    await db.insert(organizationMembers).values({
      id: 'm-owner-outra',
      orgId: otherOrg,
      userId: owner.id,
      role: 'member',
      createdAt: now,
    })

    await expect(resolveMembership(owner.id, otherOrg)).resolves.toMatchObject({
      orgId: otherOrg,
    })
    await expect(
      resolveMembership(owner.id, 'org-inexistente'),
    ).resolves.toMatchObject({ orgId: mainOrg })
    await expect(resolveMembership(outsider.id, mainOrg)).resolves.toMatchObject(
      { orgId: otherOrg },
    )
  })
})

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
import {
  listTeamspaceDocuments,
  listVisibleTeamspaces,
} from '@/lib/teamspaces'

const owner = { id: 'ts-owner', email: 'owner@arvore.com.br' }
const teamMember = { id: 'ts-member', email: 'team@arvore.com.br' }
const orgOnly = { id: 'ts-org-only', email: 'mate@arvore.com.br' }
const outsider = { id: 'ts-outsider', email: 'outside@otherschool.com.br' }

const mainOrg = 'org-arvore'
const otherOrg = 'org-other'

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
    { id: mainOrg, name: 'Árvore School', createdAt: now },
    { id: otherOrg, name: 'Other School', createdAt: now },
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
      name: 'Open team',
      access: 'open',
      createdAt: now,
    },
    {
      id: closedTeamspace,
      orgId: mainOrg,
      name: 'Closed team',
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

describe('access precedence with teamspaces', () => {
  it('the document owner beats the closed teamspace they are not part of', async () => {
    await insertDocument({
      id: 'doc-owner',
      ownerId: owner.id,
      teamspaceId: closedTeamspace,
    })

    await expect(
      getDocumentAccess('doc-owner', sessionFor(owner)),
    ).resolves.toBe('owner')
  })

  it('an explicit share beats the teamspace and can downgrade the member', async () => {
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

  it('a teamspace member inherits editor', async () => {
    await insertDocument({
      id: 'doc-team',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-team', sessionFor(teamMember)),
    ).resolves.toBe('editor')
  })

  it('the teamspace beats org_access: a teamspace member edits a doc with org_access viewer', async () => {
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

  it('an open teamspace lets any member of the organization read', async () => {
    await insertDocument({
      id: 'doc-open',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-open', sessionFor(orgOnly)),
    ).resolves.toBe('viewer')
  })

  it('a closed teamspace hides the document from whoever was not invited', async () => {
    await insertDocument({
      id: 'doc-closed',
      ownerId: owner.id,
      teamspaceId: closedTeamspace,
    })

    await expect(
      getDocumentAccess('doc-closed', sessionFor(orgOnly)),
    ).resolves.toBeNull()
  })

  it('org_access still holds when the teamspace grants nothing', async () => {
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

  it('someone from another organization does not reach an open teamspace', async () => {
    await insertDocument({
      id: 'doc-open-outsider',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })

    await expect(
      getDocumentAccess('doc-open-outsider', sessionFor(outsider)),
    ).resolves.toBeNull()
  })

  it('a document without a teamspace follows the previous precedence', async () => {
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

describe('sidebar lists', () => {
  it('a closed teamspace only shows up for whoever is part of it', async () => {
    await expect(
      listVisibleTeamspaces(mainOrg, teamMember.id),
    ).resolves.toHaveLength(2)

    const visible = await listVisibleTeamspaces(mainOrg, orgOnly.id)

    expect(visible.map((item) => item.id)).toEqual([openTeamspace])
    expect(visible[0].role).toBeNull()
  })

  it('a teamspace document leaves the Private and Organization sections', async () => {
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

  it('tells apart the organization rows the person owns from the rest', async () => {
    await insertDocument({
      id: 'doc-org-mine',
      orgAccess: 'editor',
      ownerId: owner.id,
    })
    await insertDocument({
      id: 'doc-org-theirs',
      orgAccess: 'editor',
      ownerId: teamMember.id,
    })

    const rows = await listOrganizationDocuments(mainOrg, owner.id)
    const owned = new Map(rows.map((row) => [row.id, row.owned]))

    expect(owned.get('doc-org-mine')).toBe(true)
    expect(owned.get('doc-org-theirs')).toBe(false)
  })

  it('tells apart the teamspace rows the person owns from the rest', async () => {
    await insertDocument({
      id: 'doc-team-mine',
      ownerId: owner.id,
      teamspaceId: openTeamspace,
    })
    await insertDocument({
      id: 'doc-team-theirs',
      ownerId: teamMember.id,
      teamspaceId: openTeamspace,
    })

    const rows = await listTeamspaceDocuments(openTeamspace, owner.id)
    const owned = new Map(rows.map((row) => [row.id, row.owned]))

    expect(owned.get('doc-team-mine')).toBe(true)
    expect(owned.get('doc-team-theirs')).toBe(false)
  })
})

describe('multiple organizations', () => {
  it('the person joins every organization that invited them', async () => {
    await db.insert(organizationInvites).values([
      {
        id: 'invite-1',
        orgId: mainOrg,
        email: 'newcomer@arvore.com.br',
        role: 'member',
        createdAt: new Date(),
      },
      {
        id: 'invite-2',
        orgId: otherOrg,
        email: 'newcomer@arvore.com.br',
        role: 'admin',
        createdAt: new Date(),
      },
    ])

    const now = new Date()

    await db.insert(user).values({
      id: 'ts-newcomer',
      name: 'newcomer',
      email: 'newcomer@arvore.com.br',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })

    const memberships = await acceptPendingInvites(
      'ts-newcomer',
      'newcomer@arvore.com.br',
    )

    expect(memberships.map((item) => item.orgId).sort()).toEqual(
      [mainOrg, otherOrg].sort(),
    )
    await expect(listMemberships('ts-newcomer')).resolves.toHaveLength(2)
  })

  it('the active organization comes from the preferred id and falls back to the first when it is invalid', async () => {
    const now = new Date()

    await db.insert(organizationMembers).values({
      id: 'm-owner-other',
      orgId: otherOrg,
      userId: owner.id,
      role: 'member',
      createdAt: now,
    })

    await expect(resolveMembership(owner.id, otherOrg)).resolves.toMatchObject({
      orgId: otherOrg,
    })
    await expect(
      resolveMembership(owner.id, 'org-missing'),
    ).resolves.toMatchObject({ orgId: mainOrg })
    await expect(resolveMembership(outsider.id, mainOrg)).resolves.toMatchObject(
      { orgId: otherOrg },
    )
  })
})

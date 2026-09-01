import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'

import { db } from '@/db'
import {
  documents,
  organizationMembers,
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import type {
  OrganizationRole,
  Teamspace,
  TeamspaceAccess,
  TeamspaceRole,
} from '@/db/schema'
import type { DocumentNode, DocumentSummary } from '@/lib/documents'

export type TeamspaceSummary = Readonly<{
  id: string
  name: string
  access: TeamspaceAccess
  role: TeamspaceRole | null
}>

export type TeamspaceSection = TeamspaceSummary &
  Readonly<{ documents: Array<DocumentNode> }>

export type TeamspacePerson = Readonly<{
  memberId: string
  userId: string
  name: string
  email: string
  role: TeamspaceRole
}>

export function canManageTeamspace(
  role: TeamspaceRole | null,
  orgRole: OrganizationRole | null,
) {
  return role === 'owner' || orgRole === 'owner' || orgRole === 'admin'
}

export async function getTeamspace(
  teamspaceId: string,
): Promise<Teamspace | null> {
  const row = await db.query.teamspaces.findFirst({
    where: eq(teamspaces.id, teamspaceId),
  })

  return row ?? null
}

export async function getTeamspaceRole(
  teamspaceId: string,
  userId: string,
): Promise<TeamspaceRole | null> {
  const row = await db.query.teamspaceMembers.findFirst({
    where: and(
      eq(teamspaceMembers.teamspaceId, teamspaceId),
      eq(teamspaceMembers.userId, userId),
    ),
  })

  return row?.role ?? null
}

export async function canPlaceDocuments(
  teamspaceId: string,
  userId: string,
  orgId: string | null,
) {
  const teamspace = await getTeamspace(teamspaceId)

  if (!teamspace || !orgId || teamspace.orgId !== orgId) {
    return false
  }

  const role = await getTeamspaceRole(teamspaceId, userId)

  return role !== null || teamspace.access === 'open'
}

export async function listTeamspacesForOrganization(
  orgId: string,
  userId: string,
): Promise<Array<TeamspaceSummary>> {
  const rows = await db
    .select({
      id: teamspaces.id,
      name: teamspaces.name,
      access: teamspaces.access,
      role: teamspaceMembers.role,
    })
    .from(teamspaces)
    .leftJoin(
      teamspaceMembers,
      and(
        eq(teamspaceMembers.teamspaceId, teamspaces.id),
        eq(teamspaceMembers.userId, userId),
      ),
    )
    .where(eq(teamspaces.orgId, orgId))
    .orderBy(asc(teamspaces.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    access: row.access,
    role: row.role,
  }))
}

export function isTeamspaceVisible(teamspace: TeamspaceSummary) {
  return teamspace.role !== null || teamspace.access === 'open'
}

export async function listVisibleTeamspaces(
  orgId: string,
  userId: string,
): Promise<Array<TeamspaceSummary>> {
  const rows = await listTeamspacesForOrganization(orgId, userId)

  return rows.filter(isTeamspaceVisible)
}

export async function listTeamspaceDocuments(
  teamspaceId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
      kind: documents.kind,
    })
    .from(documents)
    .where(
      and(
        eq(documents.teamspaceId, teamspaceId),
        isNull(documents.deletedAt),
        ne(documents.kind, 'row'),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false }))
}

export async function countTeamspaceDocuments(teamspaceId: string) {
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.teamspaceId, teamspaceId))

  return rows.length
}

export async function listTeamspacePeople(
  teamspaceId: string,
): Promise<Array<TeamspacePerson>> {
  const rows = await db
    .select({
      memberId: teamspaceMembers.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: teamspaceMembers.role,
    })
    .from(teamspaceMembers)
    .innerJoin(user, eq(user.id, teamspaceMembers.userId))
    .where(eq(teamspaceMembers.teamspaceId, teamspaceId))
    .orderBy(asc(teamspaceMembers.createdAt))

  return rows
}

export async function otherOwnersInTeamspace(
  teamspaceId: string,
  userId: string,
) {
  const rows = await db
    .select({ id: teamspaceMembers.id })
    .from(teamspaceMembers)
    .where(
      and(
        eq(teamspaceMembers.teamspaceId, teamspaceId),
        eq(teamspaceMembers.role, 'owner'),
        ne(teamspaceMembers.userId, userId),
      ),
    )

  return rows.length
}

export async function removeTeamspaceMemberships(
  orgId: string,
  userId: string,
) {
  const rows = await db
    .select({ id: teamspaces.id })
    .from(teamspaces)
    .where(eq(teamspaces.orgId, orgId))

  if (rows.length === 0) {
    return
  }

  await db.delete(teamspaceMembers).where(
    and(
      inArray(
        teamspaceMembers.teamspaceId,
        rows.map((row) => row.id),
      ),
      eq(teamspaceMembers.userId, userId),
    ),
  )
}

export async function isOrganizationMember(orgId: string, userId: string) {
  const row = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId),
    ),
  })

  return row !== undefined
}

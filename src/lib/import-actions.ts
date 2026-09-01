'use server'

import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { organizations, teamspaceMembers, teamspaces } from '@/db/schema'
import { getActiveMembership } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import {
  destinationOfParent,
  serializeImportDestination,
} from '@/lib/import-destination'

export type ImportDestinationOption = Readonly<{
  value: string
  label: string
}>

export type ImportDestinationsResult = Readonly<{
  organizationName: string | null
  teamspaces: ReadonlyArray<ImportDestinationOption>
  suggested: string
  parentDestination: string
}>

const privateOnly: ImportDestinationsResult = {
  organizationName: null,
  parentDestination: 'private',
  suggested: 'private',
  teamspaces: [],
}

export async function listImportDestinations(
  parentId: string,
): Promise<ImportDestinationsResult> {
  const session = await getSession()

  if (!session) {
    return privateOnly
  }

  if ((await getDocumentAccess(parentId, session)) !== 'owner') {
    return privateOnly
  }

  const membership = await getActiveMembership(session.user.id)

  if (!membership) {
    return privateOnly
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.orgId),
  })

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
        eq(teamspaceMembers.userId, session.user.id),
      ),
    )
    .where(eq(teamspaces.orgId, membership.orgId))

  const available = rows
    .filter((row) => row.role !== null || row.access === 'open')
    .map((row) => ({ label: row.name, value: `teamspace:${row.id}` }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  const parent = await getDocument(parentId)
  const fromParent = serializeImportDestination(destinationOfParent(parent))
  const reachable =
    !fromParent.startsWith('teamspace:') ||
    available.some((option) => option.value === fromParent)

  return {
    organizationName: organization?.name ?? null,
    parentDestination: fromParent,
    suggested: reachable ? fromParent : 'organization',
    teamspaces: available,
  }
}

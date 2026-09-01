import type { Document, OrgAccess } from '@/db/schema'
import { getActiveMembership } from '@/lib/active-org'
import { canPlaceDocuments, getTeamspace } from '@/lib/teamspaces'

const teamspacePrefix = 'teamspace:'

export const ORGANIZATION_IMPORT_ACCESS: OrgAccess = 'editor'

export type ImportDestination =
  | { kind: 'private' }
  | { kind: 'organization' }
  | { kind: 'teamspace'; teamspaceId: string }

export type ImportPlacement = Readonly<{
  orgId: string | null
  teamspaceId: string | null
  orgAccess: OrgAccess | null
}>

export type ImportParent = Pick<
  Document,
  'orgId' | 'teamspaceId' | 'orgAccess'
> | null

export function parseImportDestination(
  raw: unknown,
): ImportDestination | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null
  }

  if (raw === 'private') {
    return { kind: 'private' }
  }

  if (raw === 'organization') {
    return { kind: 'organization' }
  }

  if (raw.startsWith(teamspacePrefix)) {
    const teamspaceId = raw.slice(teamspacePrefix.length)

    return teamspaceId.length > 0 ? { kind: 'teamspace', teamspaceId } : null
  }

  return null
}

export function serializeImportDestination(
  destination: ImportDestination,
): string {
  return destination.kind === 'teamspace'
    ? `${teamspacePrefix}${destination.teamspaceId}`
    : destination.kind
}

export function destinationOfParent(parent: ImportParent): ImportDestination {
  if (parent?.teamspaceId) {
    return { kind: 'teamspace', teamspaceId: parent.teamspaceId }
  }

  if (parent?.orgAccess) {
    return { kind: 'organization' }
  }

  return parent ? { kind: 'private' } : { kind: 'organization' }
}

export async function resolveImportPlacement(
  destination: ImportDestination,
  userId: string,
): Promise<ImportPlacement | null> {
  const membership = await getActiveMembership(userId)

  if (destination.kind === 'private') {
    return {
      orgId: membership?.orgId ?? null,
      teamspaceId: null,
      orgAccess: null,
    }
  }

  if (destination.kind === 'organization') {
    if (!membership) {
      return null
    }

    return {
      orgId: membership.orgId,
      teamspaceId: null,
      orgAccess: ORGANIZATION_IMPORT_ACCESS,
    }
  }

  const allowed = await canPlaceDocuments(
    destination.teamspaceId,
    userId,
    membership?.orgId ?? null,
  )

  if (!allowed) {
    return null
  }

  const teamspace = await getTeamspace(destination.teamspaceId)

  if (!teamspace) {
    return null
  }

  return {
    orgId: teamspace.orgId,
    teamspaceId: teamspace.id,
    orgAccess: null,
  }
}

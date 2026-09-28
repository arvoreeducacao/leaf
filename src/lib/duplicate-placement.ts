import type { Document } from '@/db/schema'
import type { AccessLevel } from '@/lib/authz'

type DuplicatePlacement = Pick<
  Document,
  'parentId' | 'orgId' | 'teamspaceId' | 'orgAccess'
>

export function duplicatePlacement(
  source: Pick<Document, 'kind' | 'parentId' | 'orgId' | 'teamspaceId' | 'orgAccess'>,
  access: AccessLevel,
): DuplicatePlacement | null {
  const staysBesideSource =
    access === 'owner' || (access === 'editor' && source.teamspaceId !== null)

  if (staysBesideSource) {
    return {
      parentId: source.parentId,
      orgId: source.orgId,
      teamspaceId: source.teamspaceId,
      orgAccess: source.orgAccess,
    }
  }

  if (source.kind === 'row' || source.kind === 'template') {
    return null
  }

  return { parentId: null, orgId: null, teamspaceId: null, orgAccess: null }
}

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
import { createNotionClient } from '@/lib/notion/api'
import {
  getNotionConnection,
  notionOAuthConfig,
} from '@/lib/notion/connection'
import { pageTitle } from '@/lib/notion/crawl'
import { notionIdFromLink } from '@/lib/notion/link'

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

export type NotionPreview =
  | Readonly<{ state: 'unavailable' }>
  | Readonly<{ state: 'disconnected' }>
  | Readonly<{ state: 'invalidLink' }>
  | Readonly<{ state: 'unreachable' }>
  | Readonly<{
      state: 'ready'
      title: string
      childPages: number
      childDatabases: number
    }>

export async function previewNotionLink(link: string): Promise<NotionPreview> {
  const session = await getSession()

  if (!session) {
    return { state: 'disconnected' }
  }

  if (!notionOAuthConfig()) {
    return { state: 'unavailable' }
  }

  const connection = await getNotionConnection(session.user.id)

  if (!connection) {
    return { state: 'disconnected' }
  }

  const pageId = notionIdFromLink(link)

  if (!pageId) {
    return { state: 'invalidLink' }
  }

  const client = createNotionClient(connection.accessToken)

  try {
    const page = await client.page(pageId)
    let childPages = 0
    let childDatabases = 0

    for await (const block of client.children(pageId)) {
      if (block.type === 'child_page') {
        childPages += 1
      }

      if (block.type === 'child_database') {
        childDatabases += 1
      }
    }

    return {
      childDatabases,
      childPages,
      state: 'ready',
      title: pageTitle(page, ''),
    }
  } catch {
    return { state: 'unreachable' }
  }
}

export async function notionConnectionState(): Promise<
  'unavailable' | 'disconnected' | 'connected'
> {
  if (!notionOAuthConfig()) {
    return 'unavailable'
  }

  const session = await getSession()

  if (!session) {
    return 'disconnected'
  }

  return (await getNotionConnection(session.user.id))
    ? 'connected'
    : 'disconnected'
}

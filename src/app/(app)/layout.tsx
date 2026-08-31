import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { readActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import {
  buildDocumentTree,
  listPrivateDocuments,
  listSharedDocuments,
  listTrashedDocuments,
} from '@/lib/documents'
import {
  acceptPendingInvites,
  listOrganizationDocuments,
} from '@/lib/organizations'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { listTeamspaceDocuments, listVisibleTeamspaces } from '@/lib/teamspaces'

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const memberships = await acceptPendingInvites(
    session.user.id,
    session.user.email,
  )

  const activeOrgId = await readActiveOrgId()
  const membership =
    memberships.find((item) => item.orgId === activeOrgId) ??
    memberships[0] ??
    null

  const [privateDocuments, shared, trashed, organizationDocuments] =
    await Promise.all([
      listPrivateDocuments(session.user.id),
      listSharedDocuments(session.user.email),
      listTrashedDocuments(session.user.id),
      membership
        ? listOrganizationDocuments(membership.orgId)
        : Promise.resolve([]),
    ])

  const visibleTeamspaces = membership
    ? await listVisibleTeamspaces(membership.orgId, session.user.id)
    : []

  const teamspaceSections: Array<TeamspaceSection> = await Promise.all(
    visibleTeamspaces.map(async (teamspace) => ({
      ...teamspace,
      documents: buildDocumentTree(await listTeamspaceDocuments(teamspace.id)),
    })),
  )

  const locale = await getLocale()

  return (
    <AppShell
      activeOrgId={membership?.orgId ?? null}
      locale={locale}
      organizationDocuments={buildDocumentTree(organizationDocuments)}
      organizationName={membership?.orgName ?? null}
      organizations={memberships.map((item) => ({
        id: item.orgId,
        name: item.orgName,
      }))}
      owned={buildDocumentTree(privateDocuments)}
      shared={shared}
      teamspaces={teamspaceSections}
      trashed={trashed}
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShell>
  )
}

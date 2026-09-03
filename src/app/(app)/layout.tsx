import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { PendingJoinRedirect } from '@/components/app/pending-join-redirect'
import { SidebarPreferencesProvider } from '@/components/app/sidebar-preferences-provider'
import { isAiEnabled } from '@/lib/ai-config'
import { readActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import {
  buildDocumentTree,
  capDocumentTree,
  listPrivateDocuments,
  listSharedDocuments,
  listTrashedDocuments,
  pickRecentDocuments,
} from '@/lib/documents'
import {
  acceptPendingInvites,
  listOrganizationDocuments,
} from '@/lib/organizations'
import { readSidebarPreferences } from '@/lib/sidebar-preferences'
import type { TeamspaceSection } from '@/lib/teamspaces'
import { listTeamspaceDocuments, listVisibleTeamspaces } from '@/lib/teamspaces'

const recentLimit = 15

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
        ? listOrganizationDocuments(membership.orgId, session.user.id)
        : Promise.resolve([]),
    ])

  const visibleTeamspaces = membership
    ? await listVisibleTeamspaces(membership.orgId, session.user.id)
    : []

  const teamspaceDocuments = await Promise.all(
    visibleTeamspaces.map((teamspace) =>
      listTeamspaceDocuments(teamspace.id, session.user.id),
    ),
  )

  const teamspaceSections: Array<TeamspaceSection> = visibleTeamspaces.map(
    (teamspace, index) => {
      const tree = capDocumentTree(
        buildDocumentTree(teamspaceDocuments[index] ?? []),
      )

      return {
        ...teamspace,
        documents: tree.nodes,
        hiddenDocuments: tree.hidden,
      }
    },
  )

  const ownedTree = capDocumentTree(buildDocumentTree(privateDocuments))
  const organizationTree = capDocumentTree(
    buildDocumentTree(organizationDocuments),
  )

  const recents = pickRecentDocuments(
    [privateDocuments, organizationDocuments, shared, ...teamspaceDocuments],
    recentLimit,
  )

  const locale = await getLocale()
  const sidebarPreferences = await readSidebarPreferences()

  return (
    <SidebarPreferencesProvider initial={sidebarPreferences}>
      <AppShell
        activeOrgId={membership?.orgId ?? null}
        aiEnabled={isAiEnabled()}
        locale={locale}
        hiddenOrganizationDocuments={organizationTree.hidden}
        hiddenOwnedDocuments={ownedTree.hidden}
        organizationDocuments={organizationTree.nodes}
        organizationName={membership?.orgName ?? null}
        organizations={memberships.map((item) => ({
          id: item.orgId,
          name: item.orgName,
        }))}
        owned={ownedTree.nodes}
        recents={recents}
        shared={shared}
        teamspaces={teamspaceSections}
        trashed={trashed}
        user={{ name: session.user.name, email: session.user.email }}
      >
        <PendingJoinRedirect />
        {children}
      </AppShell>
    </SidebarPreferencesProvider>
  )
}

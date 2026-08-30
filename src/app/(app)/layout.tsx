import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
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

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const membership = await acceptPendingInvites(
    session.user.id,
    session.user.email,
  )

  const [privateDocuments, shared, trashed, organizationDocuments] =
    await Promise.all([
      listPrivateDocuments(session.user.id),
      listSharedDocuments(session.user.email),
      listTrashedDocuments(session.user.id),
      membership
        ? listOrganizationDocuments(membership.orgId)
        : Promise.resolve([]),
    ])

  const locale = await getLocale()

  return (
    <AppShell
      locale={locale}
      organizationDocuments={buildDocumentTree(organizationDocuments)}
      organizationName={membership?.orgName ?? null}
      owned={buildDocumentTree(privateDocuments)}
      shared={shared}
      trashed={trashed}
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShell>
  )
}

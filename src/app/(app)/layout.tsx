import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { getSession } from '@/lib/auth'
import {
  buildDocumentTree,
  listOwnedDocuments,
  listSharedDocuments,
  listTrashedDocuments,
} from '@/lib/documents'

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const [owned, shared, trashed] = await Promise.all([
    listOwnedDocuments(session.user.id),
    listSharedDocuments(session.user.email),
    listTrashedDocuments(session.user.id),
  ])

  return (
    <AppShell
      owned={buildDocumentTree(owned)}
      shared={shared}
      trashed={trashed}
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </AppShell>
  )
}

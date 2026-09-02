import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { DocumentBrowser } from '@/components/app/document-browser'
import { readActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { listPrivateDocuments, toBrowsable } from '@/lib/documents'
import { getTeamspace, listTeamspaceDocuments } from '@/lib/teamspaces'
import {
  listMemberships,
  listOrganizationDocuments,
} from '@/lib/organizations'

type Props = Readonly<{
  searchParams: Promise<{ scope?: string; id?: string }>
}>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')

  return { title: t('allDocuments') }
}

export default async function DocumentsPage({ searchParams }: Props) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { scope, id } = await searchParams
  const t = await getTranslations('nav')

  if (scope === 'private') {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col px-4 py-8 tablet:px-8 tablet:py-10">
        <DocumentBrowser
          documents={(await listPrivateDocuments(session.user.id)).map(toBrowsable)}
          title={t('privateSection')}
        />
      </div>
    )
  }

  if (scope === 'teamspace' && id) {
    const teamspace = await getTeamspace(id)

    if (!teamspace) {
      notFound()
    }

    return (
      <div className="mx-auto flex w-full max-w-content flex-col px-4 py-8 tablet:px-8 tablet:py-10">
        <DocumentBrowser
          documents={(await listTeamspaceDocuments(id, session.user.id)).map(toBrowsable)}
          title={teamspace.name}
        />
      </div>
    )
  }

  const memberships = await listMemberships(session.user.id)
  const activeOrgId = await readActiveOrgId()
  const membership =
    memberships.find((item) => item.orgId === activeOrgId) ??
    memberships[0] ??
    null

  const documents = membership
    ? (await listOrganizationDocuments(membership.orgId, session.user.id)).map(
        toBrowsable,
      )
    : []

  return (
    <div className="mx-auto flex w-full max-w-content flex-col px-4 py-8 tablet:px-8 tablet:py-10">
      <DocumentBrowser
        documents={documents}
        title={t('organizationSection')}
      />
    </div>
  )
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { CreateOrganizationForm } from '@/components/org/create-organization-form'
import { OrganizationManager } from '@/components/org/organization-manager'
import { getSession } from '@/lib/auth'
import {
  getMembership,
  listOrganizationPeople,
  listPendingInvites,
} from '@/lib/organizations'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('org') }
}

export default async function OrganizationPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const membership = await getMembership(session.user.id)

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-8 tablet:px-8 tablet:py-10">
        <CreateOrganizationForm />
      </div>
    )
  }

  const [people, invites] = await Promise.all([
    listOrganizationPeople(membership.orgId),
    listPendingInvites(membership.orgId),
  ])

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 tablet:px-8 tablet:py-10">
      <OrganizationManager
        invites={invites}
        memberId={membership.memberId}
        orgName={membership.orgName}
        people={people}
        role={membership.role}
      />
    </div>
  )
}

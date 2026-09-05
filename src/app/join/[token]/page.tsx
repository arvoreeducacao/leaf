import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import {
  JoinInvalidCard,
  JoinOrganizationCard,
  JoinSignInCard,
} from '@/components/org/join-organization-card'
import { authAccessConfig, getSession } from '@/lib/auth'
import { joinTokenPattern } from '@/lib/join-link'
import {
  getOrganizationByInviteToken,
  isMemberOf,
} from '@/lib/organizations'

type Props = Readonly<{ params: Promise<{ token: string }> }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('join') }
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params
  const organization = joinTokenPattern.test(token)
    ? await getOrganizationByInviteToken(token)
    : null

  if (!organization) {
    return <JoinInvalidCard />
  }

  const session = await getSession()

  if (!session) {
    return (
      <JoinSignInCard
        orgName={organization.name}
        showSignup={!authAccessConfig().ssoEnabled}
        token={token}
      />
    )
  }

  return (
    <JoinOrganizationCard
      alreadyMember={await isMemberOf(organization.id, session.user.id)}
      memberCount={organization.memberCount}
      orgIcon={organization.icon}
      orgId={organization.id}
      orgName={organization.name}
      token={token}
    />
  )
}

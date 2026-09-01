import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { CreateOrganizationForm } from '@/components/org/create-organization-form'
import { OrganizationManager } from '@/components/org/organization-manager'
import { TeamspaceManager } from '@/components/org/teamspace-manager'
import type { TeamspaceCard } from '@/components/org/teamspace-manager'
import { readActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import {
  canManageOrganization,
  getInviteToken,
  listMemberships,
  listOrganizationPeople,
  listPendingInvites,
} from '@/lib/organizations'
import {
  canManageTeamspace,
  countTeamspaceDocuments,
  isTeamspaceVisible,
  listTeamspacePeople,
  listTeamspacesForOrganization,
} from '@/lib/teamspaces'

type Props = Readonly<{
  searchParams: Promise<{ new?: string }>
}>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('org') }
}

export default async function OrganizationPage({ searchParams }: Props) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { new: creating } = await searchParams
  const memberships = await listMemberships(session.user.id)
  const activeOrgId = await readActiveOrgId()
  const membership =
    memberships.find((item) => item.orgId === activeOrgId) ??
    memberships[0] ??
    null

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-8 tablet:px-8 tablet:py-10">
        <CreateOrganizationForm />
      </div>
    )
  }

  const [people, invites, teamspaces] = await Promise.all([
    listOrganizationPeople(membership.orgId),
    listPendingInvites(membership.orgId),
    listTeamspacesForOrganization(membership.orgId, session.user.id),
  ])

  const manageable = canManageOrganization(membership.role)
  const inviteToken = manageable
    ? await getInviteToken(membership.orgId)
    : null

  const cards: Array<TeamspaceCard> = await Promise.all(
    teamspaces
      .filter((teamspace) => manageable || isTeamspaceVisible(teamspace))
      .map(async (teamspace) => ({
        ...teamspace,
        canManage: canManageTeamspace(teamspace.role, membership.role),
        documentCount: await countTeamspaceDocuments(teamspace.id),
        people: await listTeamspacePeople(teamspace.id),
      })),
  )

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8 tablet:px-8 tablet:py-10">
      {creating ? <CreateOrganizationForm /> : null}

      <OrganizationManager
        invites={invites}
        inviteToken={inviteToken}
        memberId={membership.memberId}
        orgName={membership.orgName}
        people={people}
        role={membership.role}
      />

      <TeamspaceManager orgPeople={people} teamspaces={cards} />
    </div>
  )
}

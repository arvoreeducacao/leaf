'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { TeamspaceFormDialog } from '@/components/app/teamspace-form-dialog'
import { AddIcon, PadlockIcon, TrashIcon, UsersIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { TeamspaceAccess, TeamspaceRole } from '@/db/schema'
import type { OrganizationPerson } from '@/lib/organizations'
import type { TeamspaceActionResult } from '@/lib/teamspace-actions'
import {
  addTeamspaceMember,
  deleteTeamspace,
  joinTeamspace,
  leaveTeamspace,
  removeTeamspaceMember,
} from '@/lib/teamspace-actions'
import type { TeamspacePerson } from '@/lib/teamspaces'

export type TeamspaceCard = Readonly<{
  id: string
  name: string
  access: TeamspaceAccess
  role: TeamspaceRole | null
  canManage: boolean
  documentCount: number
  people: ReadonlyArray<TeamspacePerson>
}>

type Props = Readonly<{
  teamspaces: ReadonlyArray<TeamspaceCard>
  orgPeople: ReadonlyArray<OrganizationPerson>
}>

export function TeamspaceManager({ teamspaces, orgPeople }: Props) {
  const t = useTranslations('teamspace')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TeamspaceCard | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [memberSelectReset, setMemberSelectReset] = useState(0)

  async function run(
    action: () => Promise<TeamspaceActionResult>,
    success: string,
  ) {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    toast.success(success)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-heading-medium text-content-strong">
          {t('sectionTitle')}
        </h2>
        <Button
          disabled={pending}
          onClick={() => setCreating(true)}
          type="button"
          variant="secondary"
        >
          <AddIcon aria-hidden="true" />
          {t('create')}
        </Button>
      </div>

      <p className="text-body-small text-content">{t('managerHint')}</p>

      {teamspaces.length === 0 ? (
        <p className="text-body-small text-content">{t('sectionEmpty')}</p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {teamspaces.map((teamspace) => {
          const available = orgPeople.filter(
            (person) =>
              !teamspace.people.some(
                (member) => member.userId === person.userId,
              ),
          )

          return (
            <li
              className="flex flex-col gap-3 rounded-large border border-line-subtle p-4"
              key={teamspace.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-bold text-body-medium text-content-strong">
                  {teamspace.name}
                </h3>
                <Badge className="gap-1" variant="info">
                  {teamspace.access === 'closed' ? (
                    <PadlockIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <UsersIcon aria-hidden="true" className="size-4" />
                  )}
                  {teamspace.access === 'closed'
                    ? t('accessClosed')
                    : t('accessOpen')}
                </Badge>
              </div>

              <ul className="flex flex-col gap-2">
                {teamspace.people.map((person) => (
                  <li
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    key={person.memberId}
                  >
                    <UserAvatar
                      email={person.email}
                      image={person.image}
                      name={person.name}
                      userId={person.userId}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-body-small text-content-strong"
                      title={person.email}
                    >
                      {person.name || person.email}
                    </span>
                    <Badge variant="info">
                      {person.role === 'owner'
                        ? t('roleOwner')
                        : t('roleMember')}
                    </Badge>
                    {teamspace.canManage ? (
                      <ButtonIcon
                        aria-label={t('removeMember', {
                          name: person.name || person.email,
                        })}
                        disabled={pending}
                        onClick={() =>
                          void run(
                            () =>
                              removeTeamspaceMember(
                                teamspace.id,
                                person.memberId,
                              ),
                            t('memberRemoved'),
                          )
                        }
                        size="large"
                        variant="ghost"
                      >
                        <TrashIcon aria-hidden="true" />
                      </ButtonIcon>
                    ) : null}
                  </li>
                ))}

                {teamspace.people.length === 0 ? (
                  <li className="text-body-small text-content">
                    {t('membersEmpty')}
                  </li>
                ) : null}
              </ul>

              {teamspace.canManage && available.length > 0 ? (
                <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center">
                  <Select
                    disabled={pending}
                    key={`${teamspace.id}-${teamspace.people.length}-${memberSelectReset}`}
                    onValueChange={(value) => {
                      void run(
                        () => addTeamspaceMember(teamspace.id, value),
                        t('memberAdded'),
                      ).finally(() =>
                        setMemberSelectReset((current) => current + 1),
                      )
                    }}
                  >
                    <SelectTrigger
                      aria-label={t('addMemberLabel', {
                        name: teamspace.name,
                      })}
                      className="w-full tablet:w-70"
                    >
                      <SelectValue placeholder={t('addMemberPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((person) => (
                        <SelectItem key={person.userId} value={person.userId}>
                          {person.name || person.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-wrap items-center gap-2">
                {teamspace.role === null && teamspace.access === 'open' ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(() => joinTeamspace(teamspace.id), t('joined'))
                    }
                    type="button"
                    variant="secondary"
                  >
                    {t('join')}
                  </Button>
                ) : null}

                {teamspace.role !== null ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(() => leaveTeamspace(teamspace.id), t('left'))
                    }
                    type="button"
                    variant="secondary"
                  >
                    {t('leave')}
                  </Button>
                ) : null}

                {teamspace.canManage ? (
                  <Button
                    disabled={pending}
                    onClick={() => setEditing(teamspace)}
                    type="button"
                    variant="secondary"
                  >
                    {t('edit')}
                  </Button>
                ) : null}

                {teamspace.canManage && confirmingDelete !== teamspace.id ? (
                  <Button
                    disabled={pending}
                    onClick={() => setConfirmingDelete(teamspace.id)}
                    type="button"
                    variant="destructive"
                  >
                    {t('delete')}
                  </Button>
                ) : null}

                {teamspace.canManage && confirmingDelete === teamspace.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-small text-content-strong">
                      {t('deleteConfirm', { name: teamspace.name })}
                      {teamspace.documentCount > 0
                        ? ` ${t('deleteWithDocs', { count: teamspace.documentCount })}`
                        : ''}
                    </span>
                    <Button
                      autoFocus
                      disabled={pending}
                      onClick={() => setConfirmingDelete(null)}
                      type="button"
                      variant="secondary"
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setConfirmingDelete(null)
                        void run(
                          () => deleteTeamspace(teamspace.id),
                          t('deleted'),
                        )
                      }}
                      type="button"
                      variant="destructive"
                    >
                      {t('delete')}
                    </Button>
                  </div>
                ) : null}

              </div>
            </li>
          )
        })}
      </ul>

      <TeamspaceFormDialog onOpenChange={setCreating} open={creating} />

      <TeamspaceFormDialog
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        open={editing !== null}
        teamspace={editing}
      />
    </section>
  )
}

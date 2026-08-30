'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { TeamIcon, TrashIcon } from '@/components/icons'
import { ConfirmRemoveMember } from '@/components/org/confirm-remove-member'
import { LeaveOrganizationDialog } from '@/components/org/leave-organization-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { InviteRole, OrganizationRole } from '@/db/schema'
import {
  cancelOrganizationInvite,
  inviteToOrganization,
  leaveOrganization,
  removeMember,
  renameOrganization,
  updateMemberRole,
} from '@/lib/org-actions'
import type { OrgActionResult } from '@/lib/org-actions'
import type { OrganizationPerson, PendingInvite } from '@/lib/organizations'

type Props = Readonly<{
  orgName: string
  role: OrganizationRole
  memberId: string
  people: ReadonlyArray<OrganizationPerson>
  invites: ReadonlyArray<PendingInvite>
}>

export function OrganizationManager({
  orgName,
  role,
  memberId,
  people,
  invites,
}: Props) {
  const t = useTranslations('org')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const roleId = useId()
  const inviteErrorId = useId()
  const nameErrorId = useId()

  const [name, setName] = useState(orgName)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [removing, setRemoving] = useState<OrganizationPerson | null>(null)
  const [removingName, setRemovingName] = useState('')

  const canManage = role === 'owner' || role === 'admin'
  const canLeave = role !== 'owner'

  const roleLabels: Record<OrganizationRole, string> = {
    owner: t('roleOwner'),
    admin: t('roleAdmin'),
    member: t('roleMember'),
  }

  async function run(action: () => Promise<OrgActionResult>, success: string) {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return false
    }

    toast.success(success)
    router.refresh()

    return true
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNameError(null)

    setPending(true)
    const result = await renameOrganization(name)
    setPending(false)

    if (!result.ok) {
      setNameError(result.error)

      return
    }

    toast.success(t('renamed'))
    router.refresh()
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteError(null)

    setPending(true)
    const result = await inviteToOrganization(email, inviteRole)
    setPending(false)

    if (!result.ok) {
      setInviteError(result.error)

      return
    }

    setEmail('')
    toast.success(t('invited'))
    router.refresh()
  }

  async function confirmRemove() {
    const target = removing

    if (!target) {
      return
    }

    await run(() => removeMember(target.memberId), t('removed'))
    setRemoving(null)
  }

  async function cancelInvite(invite: PendingInvite) {
    setPending(true)
    const result = await cancelOrganizationInvite(invite.id)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    router.refresh()

    toast.success(t('inviteCanceled'), {
      action: {
        label: tCommon('undo'),
        onClick: () => {
          void run(
            () => inviteToOrganization(invite.email, invite.role),
            t('invited'),
          )
        },
      },
      duration: 10_000,
    })
  }

  async function confirmLeave() {
    const done = await run(() => leaveOrganization(), t('left'))

    setLeaving(false)

    if (done) {
      router.push('/org')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TeamIcon aria-hidden="true" className="size-6 shrink-0 text-brand" />
          <h1 className="font-bold text-heading-large text-content-strong">
            {t('title')}
          </h1>
        </div>
        <p className="text-body-medium text-content">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3">
        {canManage ? (
          <form
            className="flex flex-col gap-3 tablet:flex-row tablet:items-end"
            onSubmit={submitName}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor={nameId}>{t('nameLabel')}</Label>
              <Input
                aria-describedby={nameError ? nameErrorId : undefined}
                aria-invalid={nameError ? true : undefined}
                className="max-w-full"
                disabled={pending}
                id={nameId}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </div>
            <Button
              aria-busy={pending}
              className="w-full tablet:w-auto"
              disabled={pending || name.trim() === orgName}
              type="submit"
              variant="secondary"
            >
              {t('rename')}
            </Button>
          </form>
        ) : null}

        {canManage && nameError ? (
          <p
            className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
            id={nameErrorId}
            role="alert"
          >
            {nameError}
          </p>
        ) : null}

        {canManage ? null : (
          <div className="flex flex-col gap-1">
            <span className="font-bold text-body-small text-content">
              {t('nameLabel')}
            </span>
            <p className="text-body-medium text-content-strong">{orgName}</p>
          </div>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold text-heading-medium text-content-strong">
            {t('membersTitle')}
          </h2>
          <span className="text-body-small text-content">
            {t('membersCount', { count: people.length })}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {people.map((person) => {
            const isSelf = person.memberId === memberId
            const editable = canManage && person.role !== 'owner'

            return (
              <li
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-large border border-line-subtle px-3 py-2"
                key={person.memberId}
              >
                <span className="flex min-w-0 flex-1 basis-full flex-col tablet:basis-0">
                  <span
                    className="truncate font-bold text-body-small text-content-strong"
                    title={person.name || person.email}
                  >
                    {person.name || person.email}
                    {isSelf ? ` (${t('you')})` : ''}
                  </span>
                  {person.name ? (
                    <span
                      className="truncate text-body-small text-content"
                      title={person.email}
                    >
                      {person.email}
                    </span>
                  ) : null}
                </span>

                {editable ? (
                  <>
                    <Select
                      disabled={pending}
                      onValueChange={(value) =>
                        void run(
                          () => updateMemberRole(person.memberId, value),
                          t('roleUpdated'),
                        )
                      }
                      value={person.role}
                    >
                      <SelectTrigger
                        aria-label={t('roleOf', {
                          name: person.name || person.email,
                        })}
                        className="w-40 shrink-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          {roleLabels.admin}
                        </SelectItem>
                        <SelectItem value="member">
                          {roleLabels.member}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <ButtonIcon
                      aria-label={t('remove', {
                        name: person.name || person.email,
                      })}
                      disabled={pending}
                      onClick={() => {
                        setRemovingName(person.name || person.email)
                        setRemoving(person)
                      }}
                      size="large"
                      variant="ghost"
                    >
                      <TrashIcon aria-hidden="true" />
                    </ButtonIcon>
                  </>
                ) : (
                  <Badge variant="info">{roleLabels[person.role]}</Badge>
                )}
              </li>
            )
          })}
        </ul>

        {canManage ? null : (
          <p className="text-body-small text-content">{t('manageHint')}</p>
        )}
      </section>

      {canManage ? (
        <>
          <Separator />

          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-heading-medium text-content-strong">
              {t('inviteTitle')}
            </h2>

            <form
              className="flex flex-col gap-3 tablet:flex-row tablet:items-end"
              onSubmit={submitInvite}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor={emailId}>{t('emailLabel')}</Label>
                <Input
                  aria-describedby={inviteError ? inviteErrorId : undefined}
                  aria-invalid={inviteError ? true : undefined}
                  autoComplete="email"
                  className="max-w-full"
                  disabled={pending}
                  id={emailId}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('emailPlaceholder')}
                  type="email"
                  value={email}
                />
              </div>
              <div className="flex flex-col gap-2 tablet:w-45">
                <Label htmlFor={roleId}>{t('roleLabel')}</Label>
                <Select
                  disabled={pending}
                  onValueChange={(value) => setInviteRole(value as InviteRole)}
                  value={inviteRole}
                >
                  <SelectTrigger id={roleId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{roleLabels.member}</SelectItem>
                    <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                aria-busy={pending}
                className="w-full tablet:w-auto"
                disabled={pending}
                type="submit"
              >
                {t('invite')}
              </Button>
            </form>

            {inviteError ? (
              <p
                className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
                id={inviteErrorId}
                role="alert"
              >
                {inviteError}
              </p>
            ) : null}

            <p className="text-body-small text-content">{t('inviteHelp')}</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-heading-medium text-content-strong">
              {t('invitesTitle')}
            </h2>

            {invites.length === 0 ? (
              <p className="text-body-small text-content">
                {t('invitesEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    className="flex min-w-0 flex-wrap items-center gap-2 rounded-large border border-line-subtle px-3 py-2"
                    key={invite.id}
                  >
                    <span className="min-w-0 flex-1 truncate text-body-small text-content-strong">
                      {invite.email}
                    </span>
                    <Badge variant="info">{roleLabels[invite.role]}</Badge>
                    <ButtonIcon
                      aria-label={t('cancelInvite', { email: invite.email })}
                      disabled={pending}
                      onClick={() => void cancelInvite(invite)}
                      size="large"
                      variant="ghost"
                    >
                      <TrashIcon aria-hidden="true" />
                    </ButtonIcon>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <Separator />

      <section className="flex flex-col items-start gap-3">
        {canLeave ? (
          <>
            <Button
              disabled={pending}
              onClick={() => setLeaving(true)}
              type="button"
              variant="secondary"
            >
              {t('leave')}
            </Button>
            <LeaveOrganizationDialog
              onConfirm={() => void confirmLeave()}
              onOpenChange={setLeaving}
              open={leaving}
              pending={pending}
            />
          </>
        ) : (
          <p className="text-body-small text-content">
            {t('ownerCannotLeave')}
          </p>
        )}
      </section>

      <ConfirmRemoveMember
        name={removingName}
        onConfirm={() => void confirmRemove()}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        open={removing !== null}
        pending={pending}
      />
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { IconPicker } from '@/components/app/icon-picker'
import { ClipboardIcon, RotateIcon, TrashIcon } from '@/components/icons'
import { ConfirmInviteLinkChange } from '@/components/org/confirm-invite-link-change'
import { ConfirmRemoveMember } from '@/components/org/confirm-remove-member'
import { DeleteOrganizationDialog } from '@/components/org/delete-organization-dialog'
import { LeaveOrganizationDialog } from '@/components/org/leave-organization-dialog'
import { OrganizationMark } from '@/components/org/organization-mark'
import {
  SettingsHint,
  SettingsList,
  SettingsListItem,
  SettingsRow,
  SettingsSection,
} from '@/components/settings/settings-panel'
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
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { InviteRole, OrganizationRole } from '@/db/schema'
import {
  cancelOrganizationInvite,
  deleteOrganization,
  disableOrganizationInviteLink,
  enableOrganizationInviteLink,
  inviteToOrganization,
  leaveOrganization,
  removeMember,
  removeOrganizationIcon,
  renameOrganization,
  setOrganizationIcon,
  updateMemberRole,
} from '@/lib/org-actions'
import type { OrgActionResult } from '@/lib/org-actions'
import type { OrganizationPerson, PendingInvite } from '@/lib/organizations'

type Props = Readonly<{
  children?: React.ReactNode
  orgName: string
  orgIcon: string | null
  role: OrganizationRole
  memberId: string
  people: ReadonlyArray<OrganizationPerson>
  invites: ReadonlyArray<PendingInvite>
  inviteToken: string | null
}>

function joinUrlFor(token: string) {
  if (typeof window === 'undefined') {
    return `/join/${token}`
  }

  return `${window.location.origin}/join/${token}`
}

export function OrganizationManager({
  children,
  orgName,
  orgIcon,
  role,
  memberId,
  people,
  invites,
  inviteToken,
}: Props) {
  const t = useTranslations('org')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const nameId = useId()
  const emailId = useId()
  const roleId = useId()
  const inviteErrorId = useId()
  const nameErrorId = useId()
  const inviteLinkSwitchId = useId()
  const inviteLinkId = useId()

  const [name, setName] = useState(orgName)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState<OrganizationPerson | null>(null)
  const [removingName, setRemovingName] = useState('')
  const [confirmingLink, setConfirmingLink] = useState<
    'disable' | 'reset' | null
  >(null)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

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

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('inviteLinkCopied'))
    } catch {
      toast.error(t('inviteLinkCopyFailed'))
    }
  }

  async function confirmLinkChange() {
    const mode = confirmingLink

    if (!mode) {
      return
    }

    await run(
      () =>
        mode === 'disable'
          ? disableOrganizationInviteLink()
          : enableOrganizationInviteLink(),
      mode === 'disable' ? t('inviteLinkDisabled') : t('inviteLinkReset'),
    )
    setConfirmingLink(null)
  }

  async function confirmLeave() {
    const done = await run(() => leaveOrganization(), t('left'))

    setLeaving(false)

    if (done) {
      router.push('/org')
    }
  }

  async function confirmDelete() {
    const done = await run(() => deleteOrganization(), t('deletedOrg'))

    setDeleting(false)

    if (done) {
      router.push('/org')
    }
  }

  return (
    <>
      <SettingsSection>
        <div className="flex flex-wrap items-center gap-4">
          {canManage ? (
            <button
              aria-label={orgIcon ? t('iconChange') : t('iconAdd')}
              className="cursor-pointer rounded-large outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="org-icon-button"
              disabled={pending}
              onClick={() => setIconPickerOpen(true)}
              type="button"
            >
              <OrganizationMark icon={orgIcon} name={orgName} size="large" />
            </button>
          ) : (
            <OrganizationMark icon={orgIcon} name={orgName} size="large" />
          )}

          {canManage ? (
            <form
              className="flex min-w-0 flex-1 flex-col gap-2"
              onSubmit={submitName}
            >
              <Label
                className="font-medium text-body-small text-content-strong"
                htmlFor={nameId}
              >
                {t('nameLabel')}
              </Label>
              <div className="flex min-w-0 flex-col gap-2 tablet:flex-row">
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
                <Button
                  aria-busy={pending}
                  className="w-full tablet:w-auto"
                  disabled={pending || name.trim() === orgName}
                  type="submit"
                  variant="secondary"
                >
                  {t('rename')}
                </Button>
              </div>
              <SettingsHint>{t('iconHelp')}</SettingsHint>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-body-small text-content-strong">
                {t('nameLabel')}
              </span>
              <p className="text-body-medium text-content-strong">{orgName}</p>
            </div>
          )}
        </div>

        {canManage && nameError ? (
          <p
            className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
            id={nameErrorId}
            role="alert"
          >
            {nameError}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        action={
          <span className="text-caption text-content">
            {t('membersCount', { count: people.length })}
          </span>
        }
        title={t('membersTitle')}
      >
        <SettingsList>
          {people.map((person) => {
            const isSelf = person.memberId === memberId
            const editable = canManage && person.role !== 'owner'

            return (
              <SettingsListItem key={person.memberId}>
                <UserAvatar
                  className="size-7"
                  email={person.email}
                  image={person.image}
                  name={person.name}
                  userId={person.userId}
                />
                <span className="flex min-w-0 flex-1 basis-full flex-col tablet:basis-0">
                  <span
                    className="truncate font-medium text-body-small text-content-strong"
                    title={person.name || person.email}
                  >
                    {person.name || person.email}
                    {isSelf ? ` (${t('you')})` : ''}
                  </span>
                  {person.name ? (
                    <span
                      className="truncate text-caption text-content"
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
                        className="w-32 shrink-0"
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
                  <span className="shrink-0 text-caption text-content">
                    {roleLabels[person.role]}
                  </span>
                )}
              </SettingsListItem>
            )
          })}
        </SettingsList>

        {canManage ? null : <SettingsHint>{t('manageHint')}</SettingsHint>}
      </SettingsSection>

      {canManage ? (
        <SettingsSection
          description={t('inviteHelp')}
          title={t('inviteTitle')}
        >
          <form
            className="flex flex-col gap-2 tablet:flex-row tablet:items-end"
            onSubmit={submitInvite}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5 tablet:w-36">
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
        </SettingsSection>
      ) : null}

      {canManage ? (
        <SettingsSection>
          <SettingsRow
            control={
              <Switch
                checked={inviteToken !== null}
                disabled={pending}
                id={inviteLinkSwitchId}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setConfirmingLink('disable')

                    return
                  }

                  void run(
                    () => enableOrganizationInviteLink(),
                    t('inviteLinkEnabled'),
                  )
                }}
              />
            }
            description={t('inviteLinkHelp')}
            htmlFor={inviteLinkSwitchId}
            title={t('inviteLinkTitle')}
          />

          <ConfirmInviteLinkChange
            mode={confirmingLink ?? 'disable'}
            onConfirm={() => void confirmLinkChange()}
            onOpenChange={(open) => {
              if (!open) {
                setConfirmingLink(null)
              }
            }}
            open={confirmingLink !== null}
            pending={pending}
          />

          {inviteToken ? (
            <div className="flex flex-col gap-2 tablet:flex-row tablet:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor={inviteLinkId}>{t('inviteLinkAddress')}</Label>
                <Input
                  className="max-w-full"
                  data-testid="org-invite-link"
                  id={inviteLinkId}
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  value={joinUrlFor(inviteToken)}
                />
              </div>
              <Button
                className="w-full tablet:w-auto"
                onClick={() => void copyInviteLink(joinUrlFor(inviteToken))}
                type="button"
                variant="secondary"
              >
                <ClipboardIcon aria-hidden="true" />
                {t('inviteLinkCopy')}
              </Button>
              <Button
                className="w-full tablet:w-auto"
                disabled={pending}
                onClick={() => setConfirmingLink('reset')}
                type="button"
                variant="secondary"
              >
                <RotateIcon aria-hidden="true" />
                {t('inviteLinkResetAction')}
              </Button>
            </div>
          ) : null}
        </SettingsSection>
      ) : null}

      {canManage ? (
        <SettingsSection title={t('invitesTitle')}>
          {invites.length === 0 ? (
            <SettingsHint>{t('invitesEmpty')}</SettingsHint>
          ) : (
            <SettingsList>
              {invites.map((invite) => (
                <SettingsListItem key={invite.id}>
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
                </SettingsListItem>
              ))}
            </SettingsList>
          )}
        </SettingsSection>
      ) : null}

      {children}

      <SettingsSection>
        {canLeave ? (
          <>
            <SettingsRow
              control={
                <Button
                  className="w-full tablet:w-auto"
                  disabled={pending}
                  onClick={() => setLeaving(true)}
                  type="button"
                  variant="secondary"
                >
                  {t('leave')}
                </Button>
              }
              description={t('leaveDescription')}
            />
            <LeaveOrganizationDialog
              onConfirm={() => void confirmLeave()}
              onOpenChange={setLeaving}
              open={leaving}
              pending={pending}
            />
          </>
        ) : (
          <SettingsHint>{t('ownerCannotLeave')}</SettingsHint>
        )}

        {role === 'owner' ? (
          <>
            <SettingsRow
              control={
                <Button
                  className="w-full tablet:w-auto"
                  data-testid="delete-org"
                  disabled={pending}
                  onClick={() => setDeleting(true)}
                  type="button"
                  variant="destructive"
                >
                  {t('deleteOrgAction')}
                </Button>
              }
              description={t('deleteOrgDescription')}
            />
            <DeleteOrganizationDialog
              onConfirm={() => void confirmDelete()}
              onOpenChange={setDeleting}
              open={deleting}
              orgName={orgName}
              pending={pending}
            />
          </>
        ) : null}
      </SettingsSection>

      {canManage ? (
        <IconPicker
          currentIcon={orgIcon}
          description={t('iconPickerDescription')}
          onApplied={() => router.refresh()}
          onApply={setOrganizationIcon}
          onOpenChange={setIconPickerOpen}
          onRemove={removeOrganizationIcon}
          open={iconPickerOpen}
          removedMessage={t('iconRemoved')}
          title={t('iconPickerTitle')}
        />
      ) : null}

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
    </>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import {
  ClipboardIcon,
  GlobeIcon,
  TeamIcon,
  TrashIcon,
} from '@/components/icons'
import { ConfirmDisablePublicLink } from '@/components/sharing/confirm-disable-public-link'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import type { ShareRole } from '@/db/schema'
import {
  disablePublicLink,
  enablePublicLink,
  inviteToDocument,
  loadShareState,
  removeShare,
  setOrganizationAccess,
  updateShareRole,
} from '@/lib/share-actions'
import type {
  SharePerson,
  ShareResult,
  ShareState,
} from '@/lib/share-actions'

type Props = Readonly<{
  documentId: string
  canManage: boolean
}>

function publicUrlFor(token: string) {
  if (typeof window === 'undefined') {
    return `/share/${token}`
  }

  return `${window.location.origin}/share/${token}`
}

export function SharePanel({ documentId, canManage }: Props) {
  const t = useTranslations('share')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const roleLabels: Record<ShareRole, string> = {
    viewer: t('roleViewer'),
    commenter: t('roleCommenter'),
    editor: t('roleEditor'),
  }
  const roleOptions: ReadonlyArray<ShareRole> = ['viewer', 'commenter', 'editor']
  const emailFieldId = useId()
  const roleFieldId = useId()
  const inviteErrorId = useId()
  const publicSwitchId = useId()
  const publicLinkId = useId()

  const [state, setState] = useState<ShareState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ShareRole>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [confirmingDisable, setConfirmingDisable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await loadShareState(documentId)

    if (result.ok) {
      setState(result.state)
    } else {
      setLoadError(result.error)
    }

    setLoading(false)
  }, [documentId])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<ShareResult>, success: string) {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return result
    }

    setState(result.state)
    setStatus(success)

    return result
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteError(null)

    const email = inviteEmail.trim()

    if (email.length === 0) {
      setInviteError(tErrors('invalidEmail'))

      return
    }

    setPending(true)
    const result = await inviteToDocument(documentId, email, inviteRole)
    setPending(false)

    if (!result.ok) {
      setInviteError(result.error)

      return
    }

    setState(result.state)
    setInviteEmail('')
    setStatus(t('invited'))
    toast.success(t('invited'))
  }

  async function removePerson(person: SharePerson) {
    const result = await run(
      () => removeShare(documentId, person.id),
      t('accessRemoved'),
    )

    if (!result.ok) {
      return
    }

    toast.success(t('accessRemoved'), {
      action: {
        label: tCommon('undo'),
        onClick: () => {
          void run(
            () => inviteToDocument(documentId, person.email, person.role),
            t('accessRestored'),
          )
        },
      },
    })
  }

  async function confirmDisable() {
    const result = await run(
      () => disablePublicLink(documentId),
      t('publicLinkDisabled'),
    )

    setConfirmingDisable(false)

    if (result.ok) {
      toast.success(t('publicLinkDisabled'))
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        className="flex flex-col gap-4"
        data-testid="share-panel-loading"
        role="status"
      >
        {canManage ? <Skeleton className="h-12 w-full" /> : null}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    )
  }

  if (loadError || !state) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-body-small text-content" role="alert">
          {loadError ?? t('loadFailed')}
        </p>
        <Button onClick={() => void load()} type="button" variant="secondary">
          {tCommon('tryAgain')}
        </Button>
      </div>
    )
  }

  const isOwner = state.role === 'owner'
  const publicUrl = state.publicToken ? publicUrlFor(state.publicToken) : null

  return (
    <div className="flex flex-col gap-6">
      <span aria-live="polite" className="sr-only">
        {status}
      </span>

      {state.orgName ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-bold text-body-small text-content">
            {t('orgSection')}
          </h3>

          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <TeamIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-content-muted"
              />
              <span className="min-w-0 truncate text-body-small text-content-strong">
                {t('orgEveryone', { name: state.orgName })}
              </span>
            </div>

            {isOwner ? (
              <Select
                disabled={pending}
                onValueChange={(value) =>
                  void run(
                    () => setOrganizationAccess(documentId, value),
                    t('orgAccessUpdated'),
                  )
                }
                value={state.orgAccess ?? 'none'}
              >
                <SelectTrigger
                  aria-label={t('orgAccessLabel')}
                  className="w-full shrink-0 tablet:w-45"
                  data-testid="org-access-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('orgNone')}</SelectItem>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {roleLabels[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="info">
                {state.orgAccess ? roleLabels[state.orgAccess] : t('orgNone')}
              </Badge>
            )}
          </div>

          <p className="text-body-small text-content">{t('orgHelp')}</p>
        </section>
      ) : null}

      {state.orgName ? <Separator /> : null}

      <section className="flex flex-col gap-4">
        <h3 className="font-bold text-body-small text-content">
          {t('peopleSection')}
        </h3>

      {isOwner ? (
        <form className="flex flex-col gap-3" onSubmit={submitInvite}>
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor={emailFieldId}>{t('emailLabel')}</Label>
              <Input
                aria-describedby={inviteError ? inviteErrorId : undefined}
                aria-invalid={inviteError ? true : undefined}
                autoComplete="email"
                className="max-w-full"
                disabled={pending}
                id={emailFieldId}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                type="email"
                value={inviteEmail}
              />
            </div>
            <div className="flex flex-col gap-2 tablet:w-45">
              <Label htmlFor={roleFieldId}>{t('roleLabel')}</Label>
              <Select
                disabled={pending}
                onValueChange={(value) => setInviteRole(value as ShareRole)}
                value={inviteRole}
              >
                <SelectTrigger id={roleFieldId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {roleLabels[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {inviteError ? (
            <p
              className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
              id={inviteErrorId}
              role="alert"
            >
              {inviteError}
            </p>
          ) : null}

          <Button
            aria-busy={pending}
            className="w-full tablet:w-auto tablet:self-end"
            disabled={pending}
            type="submit"
          >
            {t('invite')}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-col gap-3">
        <h4 className="font-bold text-body-small text-content">
          {t('withAccess')}
        </h4>

        <ul className="flex flex-col gap-2">
          <li className="flex min-w-0 items-center gap-2 py-1">
            <span
              className="min-w-0 flex-1 truncate text-body-small text-content-strong"
              title={state.ownerEmail}
            >
              {state.ownerEmail}
            </span>
            <Badge variant="info">{t('owner')}</Badge>
          </li>

          {state.people.map((person) => (
            <li
              className="flex min-w-0 flex-wrap items-center gap-2 py-1"
              key={person.id}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="truncate text-body-small text-content-strong"
                  title={person.email}
                >
                  {person.email}
                </span>
                {person.external ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="warning">{t('externalGuest')}</Badge>
                    <span className="sr-only">{t('externalGuestHint')}</span>
                  </span>
                ) : null}
              </span>

              {isOwner ? (
                <>
                  <Select
                    disabled={pending}
                    onValueChange={(value) =>
                      void run(
                        () => updateShareRole(documentId, person.id, value),
                        t('roleUpdated'),
                      )
                    }
                    value={person.role}
                  >
                    <SelectTrigger
                      aria-label={t('roleOf', { email: person.email })}
                      className="w-40 shrink-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {roleLabels[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ButtonIcon
                    aria-label={t('removeAccess', { email: person.email })}
                    disabled={pending}
                    onClick={() => void removePerson(person)}
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
          ))}
        </ul>

        {state.people.length === 0 ? (
          <p className="text-body-small text-content">
            {t('noPeople')}
          </p>
        ) : null}

        {isOwner ? null : (
          <p className="text-body-small text-content">
            {t('ownerOnly')}
          </p>
        )}
        </div>
      </section>

      {isOwner ? (
        <>
          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <GlobeIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-content-muted"
                />
                <Label
                  className="font-bold text-body-small text-content-strong"
                  htmlFor={publicSwitchId}
                >
                  {t('publicLink')}
                </Label>
              </div>
              <Switch
                checked={state.publicToken !== null}
                disabled={pending}
                id={publicSwitchId}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setConfirmingDisable(true)

                    return
                  }

                  void run(
                    () => enablePublicLink(documentId),
                    t('publicLinkEnabled'),
                  )
                }}
              />
            </div>

            <ConfirmDisablePublicLink
              onConfirm={() => void confirmDisable()}
              onOpenChange={setConfirmingDisable}
              open={confirmingDisable}
              pending={pending}
            />

            <p className="text-body-small text-content">
              {t('publicLinkHelp')}
            </p>

            {publicUrl ? (
              <div className="flex flex-col gap-2 tablet:flex-row tablet:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor={publicLinkId}>{t('linkAddress')}</Label>
                  <Input
                    className="max-w-full"
                    id={publicLinkId}
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={publicUrl}
                  />
                </div>
                <Button
                  className="w-full tablet:w-auto"
                  onClick={() => void copyLink(publicUrl)}
                  type="button"
                  variant="secondary"
                >
                  <ClipboardIcon aria-hidden="true" />
                  {t('copy')}
                </Button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}

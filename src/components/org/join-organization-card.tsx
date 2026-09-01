'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { LeafMark } from '@/components/app/leaf-mark'
import { TeamIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { pendingJoinFlag } from '@/lib/join-link'
import {
  joinOrganizationByLink,
  setActiveOrganization,
} from '@/lib/org-actions'
import { writeSessionFlag } from '@/shared/storage'

type Shell = Readonly<{ children: React.ReactNode }>

function JoinShell({ children }: Shell) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-app px-6 py-10">
      <div className="flex w-full max-w-96 flex-col gap-6">
        <div className="flex items-center gap-2">
          <LeafMark aria-hidden="true" className="size-6 text-brand" />
          <span className="font-bold text-content-strong text-heading-medium">
            Leaf
          </span>
        </div>
        {children}
      </div>
    </main>
  )
}

type InviteProps = Readonly<{
  token: string
  orgId: string
  orgName: string
  memberCount: number
  alreadyMember: boolean
}>

export function JoinOrganizationCard({
  token,
  orgId,
  orgName,
  memberCount,
  alreadyMember,
}: InviteProps) {
  const t = useTranslations('join')
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleJoin() {
    setPending(true)

    const result = alreadyMember
      ? await setActiveOrganization(orgId)
      : await joinOrganizationByLink(token)

    if (!result.ok) {
      setPending(false)
      toast.error(result.error)

      return
    }

    if (!alreadyMember) {
      toast.success(t('joined'))
    }

    router.push('/')
    router.refresh()
  }

  return (
    <JoinShell>
      <div className="flex flex-col gap-4 rounded-large border border-line bg-surface-card p-6">
        <div className="flex items-center gap-3">
          <TeamIcon
            aria-hidden="true"
            className="size-8 shrink-0 text-brand"
          />
          <div className="flex min-w-0 flex-col">
            <h1 className="font-bold text-content-strong text-heading-medium">
              {t('heading', { org: orgName })}
            </h1>
            <p className="text-body-small text-content">
              {t('memberCount', { count: memberCount })}
            </p>
          </div>
        </div>

        {alreadyMember ? (
          <p className="text-body-small text-content">{t('alreadyMember')}</p>
        ) : null}

        <Button
          aria-busy={pending}
          data-testid="join-organization"
          disabled={pending}
          onClick={() => void handleJoin()}
          type="button"
        >
          {alreadyMember ? t('open') : t('join')}
        </Button>
      </div>
    </JoinShell>
  )
}

type SignInProps = Readonly<{
  token: string
  orgName: string
  showSignup: boolean
}>

export function JoinSignInCard({ token, orgName, showSignup }: SignInProps) {
  const t = useTranslations('join')

  useEffect(() => {
    writeSessionFlag(pendingJoinFlag, token)
  }, [token])

  return (
    <JoinShell>
      <div className="flex flex-col gap-4 rounded-large border border-line bg-surface-card p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-content-strong text-heading-medium">
            {t('heading', { org: orgName })}
          </h1>
          <p className="text-body-small text-content">{t('signInHint')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/login">{t('signIn')}</Link>
          </Button>
          {showSignup ? (
            <Button asChild variant="secondary">
              <Link href="/signup">{t('createAccount')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </JoinShell>
  )
}

export function JoinInvalidCard() {
  const t = useTranslations('join')

  return (
    <JoinShell>
      <div className="flex flex-col gap-4 rounded-large border border-line bg-surface-card p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-content-strong text-heading-medium">
            {t('invalidTitle')}
          </h1>
          <p className="text-body-small text-content">{t('invalidHint')}</p>
        </div>

        <Button asChild variant="secondary">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </JoinShell>
  )
}

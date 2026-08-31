'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { AlertIcon, LeafIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { emailDomainErrorCode } from '@/lib/email-domain'

type Props = Readonly<{
  errorCode: string | null
  providerId: string
  restrictedDomain: string | null
}>

export function SsoSignIn({ errorCode, providerId, restrictedDomain }: Props) {
  const t = useTranslations('auth')
  const hintId = useId()
  const errorId = useId()

  const [error, setError] = useState<string | null>(
    errorCode
      ? errorCode === emailDomainErrorCode
        ? t('domainRestricted', { domain: restrictedDomain ?? '' })
        : t('ssoFailed')
      : null,
  )
  const [pending, setPending] = useState(false)
  const alertRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (errorCode) {
      alertRef.current?.focus()
    }
  }, [errorCode])

  async function handleSignIn() {
    setError(null)
    setPending(true)

    const result = await authClient.signIn.social({
      callbackURL: '/',
      errorCallbackURL: '/login',
      provider: providerId,
    })

    if (result.error) {
      setPending(false)
      setError(
        result.error.code === emailDomainErrorCode
          ? t('domainRestricted', { domain: restrictedDomain ?? '' })
          : t('ssoFailed'),
      )
    }
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-110 rounded-xlarge border border-line-subtle bg-surface-card p-6 text-center shadow-down-medium tablet:p-8">
        <div className="flex items-center justify-center gap-2 text-brand">
          <LeafIcon aria-hidden="true" className="size-7" />
          <span className="font-bold text-heading-medium text-content-strong">
            Leaf
          </span>
        </div>

        <h1 className="mt-6 font-bold text-heading-large text-content-strong">
          {t('ssoTitle')}
        </h1>
        <p className="mt-2 text-body-small text-content">{t('ssoSubtitle')}</p>

        {error ? (
          <p
            className="mt-6 flex items-start gap-2 rounded-large bg-danger-surface p-3 text-left text-body-small text-danger outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
            id={errorId}
            ref={alertRef}
            role="alert"
            tabIndex={-1}
          >
            <AlertIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button
          aria-busy={pending}
          aria-describedby={
            [restrictedDomain ? hintId : null, error ? errorId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="mt-6 w-full"
          disabled={pending}
          onClick={handleSignIn}
          type="button"
        >
          {t('ssoSubmit')}
        </Button>

        {restrictedDomain ? (
          <p className="mt-3 text-body-small text-content" id={hintId}>
            {t('ssoDomainHint', { domain: restrictedDomain })}
          </p>
        ) : null}
      </div>
    </main>
  )
}

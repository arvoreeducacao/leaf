'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { LeafMark } from '@/components/app/leaf-mark'
import { AlertIcon, CheckCircleIcon, PluginIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

type Props = Readonly<{
  clientName: string | null
  clientUri: string | null
  redirectHost: string | null
  scopes: ReadonlyArray<string>
  userEmail: string
}>

const scopeLabelKeys: Record<string, 'scopeRead' | 'scopeWrite' | 'scopeOffline'> = {
  'leaf:read': 'scopeRead',
  'leaf:write': 'scopeWrite',
  offline_access: 'scopeOffline',
}

type ConsentResponse = Readonly<{ url?: string; redirect_uri?: string }>

export function ConsentForm({
  clientName,
  clientUri,
  redirectHost,
  scopes,
  userEmail,
}: Props) {
  const t = useTranslations('oauthConsent')
  const errorId = useId()
  const [pending, setPending] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayName = clientName ?? t('unknownClient')

  async function decide(accept: boolean) {
    setError(null)
    setPending(accept ? 'allow' : 'deny')

    const result = await authClient.oauth2.consent({ accept })
    const data = result.data as ConsentResponse | null
    const target = data?.url ?? data?.redirect_uri

    if (result.error || !target) {
      setPending(null)
      setError(t('failed'))

      return
    }

    window.location.assign(target)
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-app px-6 py-10">
      <div className="w-full max-w-100">
        <div className="flex items-center gap-2">
          <LeafMark aria-hidden="true" className="size-6 text-brand" />
          <span className="font-semibold text-content-strong text-heading-medium">
            Leaf
          </span>
        </div>

        <div className="mt-10 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-large bg-surface-subtle text-content">
            <PluginIcon aria-hidden="true" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-semibold text-content-strong text-heading-large">
              {t('title')}
            </h1>
            <p className="text-body-small text-content">
              {t('subtitle', { client: displayName })}
            </p>
          </div>
        </div>

        <dl className="mt-8 flex flex-col gap-3 rounded-large border border-line bg-surface-card p-4 text-body-small">
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-content-strong">{t('clientLabel')}</dt>
            <dd className="truncate font-medium text-content-strong">
              {displayName}
              {clientUri ? (
                <span className="ml-1 font-normal text-content">
                  ({clientUri})
                </span>
              ) : null}
            </dd>
          </div>
          {redirectHost ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-content-strong">
                {t('redirectLabel')}
              </dt>
              <dd className="truncate font-medium text-content-strong">
                {redirectHost}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-content-strong">{t('accountLabel')}</dt>
            <dd className="truncate font-medium text-content-strong">{userEmail}</dd>
          </div>
        </dl>

        <section className="mt-6" aria-labelledby="consent-scopes">
          <h2
            className="font-semibold text-body-small text-content-strong"
            id="consent-scopes"
          >
            {t('scopesTitle')}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {scopes.map((scope) => (
              <li className="flex items-start gap-2 text-body-small text-content" key={scope}>
                <CheckCircleIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-positive"
                />
                <span>{t(scopeLabelKeys[scope] ?? 'scopeRead')}</span>
              </li>
            ))}
          </ul>
        </section>

        {error ? (
          <p
            className="mt-6 flex items-start gap-2 rounded-large bg-danger-surface p-3 text-body-small text-danger"
            id={errorId}
            role="alert"
          >
            <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end">
          <Button
            aria-busy={pending === 'deny'}
            aria-describedby={error ? errorId : undefined}
            disabled={pending !== null}
            onClick={() => decide(false)}
            size="lg"
            type="button"
            variant="secondary"
          >
            {t('deny')}
          </Button>
          <Button
            aria-busy={pending === 'allow'}
            aria-describedby={error ? errorId : undefined}
            disabled={pending !== null}
            onClick={() => decide(true)}
            size="lg"
            type="button"
          >
            {t('allow')}
          </Button>
        </div>

        <p className="mt-6 text-body-small text-content">{t('revokeHint')}</p>
      </div>
    </main>
  )
}

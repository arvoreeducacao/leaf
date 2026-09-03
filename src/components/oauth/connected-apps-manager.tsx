'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { PluginIcon } from '@/components/icons'
import { ConfirmRevokeApp } from '@/components/oauth/confirm-revoke-app'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ConnectedApp } from '@/lib/connected-apps'
import { revokeConnectedAppAccess } from '@/lib/connected-apps-actions'

type Props = Readonly<{
  apps: ReadonlyArray<ConnectedApp>
  mcpUrl: string
}>

const scopeLabelKeys: Record<string, 'scopeRead' | 'scopeWrite' | 'scopeOffline'> = {
  'leaf:read': 'scopeRead',
  'leaf:write': 'scopeWrite',
  offline_access: 'scopeOffline',
}

export function ConnectedAppsManager({ apps, mcpUrl }: Props) {
  const t = useTranslations('connectedApps')
  const format = useFormatter()
  const router = useRouter()
  const [revoking, setRevoking] = useState<ConnectedApp | null>(null)
  const [pending, setPending] = useState(false)

  function nameOf(app: ConnectedApp) {
    return app.name?.trim() || t('unknownClient')
  }

  async function confirmRevoke() {
    if (!revoking) {
      return
    }

    setPending(true)
    const result = await revokeConnectedAppAccess(revoking.consentId)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    toast.success(t('revoked'))
    setRevoking(null)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold text-content-strong text-heading-large">
          {t('title')}
        </h1>
        <p className="text-body-medium text-content">{t('subtitle')}</p>
      </header>

      <div className="flex flex-col gap-1 rounded-large border border-line bg-surface-card p-4">
        <span className="text-caption text-content">{t('mcpUrlLabel')}</span>
        <code className="break-all font-mono text-body-small text-content-strong">
          {mcpUrl}
        </code>
        <p className="text-body-small text-content">{t('mcpUrlHelp')}</p>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-large border border-line-subtle border-dashed px-6 py-10 text-center">
          <PluginIcon aria-hidden="true" className="size-8 text-content-subtle" />
          <h2 className="font-medium text-body-medium text-content-strong">
            {t('empty')}
          </h2>
          <p className="max-w-prose-leaf text-body-small text-content">{t('emptyHelp')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {apps.map((app) => (
            <li
              className="flex flex-col gap-3 rounded-large border border-line bg-surface-card p-4 tablet:flex-row tablet:items-start tablet:justify-between"
              key={app.consentId}
            >
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <PluginIcon aria-hidden="true" className="size-4 shrink-0 text-content-subtle" />
                  <span className="truncate font-semibold text-body-medium text-content-strong">
                    {nameOf(app)}
                  </span>
                </div>
                {app.uri ? (
                  <span className="truncate text-caption text-content">{app.uri}</span>
                ) : null}
                {app.grantedAt ? (
                  <span className="text-caption text-content">
                    {t('grantedAt', {
                      date: format.dateTime(new Date(app.grantedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </span>
                ) : null}
                <ul aria-label={t('scopesLabel')} className="flex flex-wrap gap-1.5">
                  {app.scopes.map((scope) => (
                    <li key={scope}>
                      <Badge variant="outline">
                        {t(scopeLabelKeys[scope] ?? 'scopeRead')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                aria-label={t('revoke', { name: nameOf(app) })}
                className="shrink-0 self-start"
                onClick={() => setRevoking(app)}
                size="lg"
                type="button"
                variant="secondary"
              >
                {t('revokeAction')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmRevokeApp
        name={revoking ? nameOf(revoking) : ''}
        onConfirm={confirmRevoke}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setRevoking(null)
          }
        }}
        open={revoking !== null}
        pending={pending}
      />
    </section>
  )
}

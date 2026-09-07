'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { PluginIcon } from '@/components/icons'
import { ConfirmRevokeApp } from '@/components/oauth/confirm-revoke-app'
import {
  SettingsHint,
  SettingsList,
  SettingsListItem,
  SettingsSection,
} from '@/components/settings/settings-panel'
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
    <>
      <SettingsSection>
        <div className="flex flex-col gap-1.5 py-2">
          <span className="font-medium text-body-small text-content-strong">
            {t('mcpUrlLabel')}
          </span>
          <code className="block break-all rounded-large bg-code-surface px-3 py-2 font-mono text-caption text-content-strong">
            {mcpUrl}
          </code>
          <SettingsHint>{t('mcpUrlHelp')}</SettingsHint>
        </div>
      </SettingsSection>

      <SettingsSection>
        {apps.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-large border border-line-subtle border-dashed px-6 py-10 text-center">
            <PluginIcon
              aria-hidden="true"
              className="size-6 text-content-subtle"
            />
            <p className="font-medium text-body-small text-content-strong">
              {t('empty')}
            </p>
            <SettingsHint>{t('emptyHelp')}</SettingsHint>
          </div>
        ) : (
          <SettingsList>
            {apps.map((app) => (
              <SettingsListItem
                className="items-start gap-3"
                key={app.consentId}
              >
                <PluginIcon
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-content-subtle"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium text-body-small text-content-strong">
                    {nameOf(app)}
                  </span>
                  {app.uri ? (
                    <span className="truncate text-caption text-content">
                      {app.uri}
                    </span>
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
                  <ul
                    aria-label={t('scopesLabel')}
                    className="flex flex-wrap gap-1.5"
                  >
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
                  className="shrink-0"
                  onClick={() => setRevoking(app)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t('revokeAction')}
                </Button>
              </SettingsListItem>
            ))}
          </SettingsList>
        )}
      </SettingsSection>

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
    </>
  )
}

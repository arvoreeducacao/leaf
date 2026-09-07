'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { FingerprintIcon, TrashIcon } from '@/components/icons'
import {
  SettingsHint,
  SettingsList,
  SettingsListItem,
  SettingsSection,
} from '@/components/settings/settings-panel'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function PasskeyManager() {
  const t = useTranslations('account')
  const locale = useLocale()
  const { data: passkeys, isPending } = authClient.useListPasskeys()
  const [busy, setBusy] = useState(false)

  async function addPasskey() {
    setBusy(true)

    const result = await authClient.passkey.addPasskey()

    setBusy(false)

    if (result?.error) {
      toast.error(t('passkeyAddFailed'))
      return
    }

    toast.success(t('passkeyAdded'))
  }

  async function removePasskey(id: string) {
    setBusy(true)

    const result = await authClient.passkey.deletePasskey({ id })

    setBusy(false)

    if (result?.error) {
      toast.error(t('passkeyRemoveFailed'))
      return
    }

    toast.success(t('passkeyRemoved'))
  }

  return (
    <SettingsSection
      action={
        <Button
          aria-busy={busy}
          disabled={busy}
          onClick={addPasskey}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t('passkeyAdd')}
        </Button>
      }
      description={t('passkeyHint')}
      title={t('passkeyTitle')}
    >
      {isPending ? null : passkeys && passkeys.length > 0 ? (
        <SettingsList>
          {passkeys.map((passkey) => (
            <SettingsListItem key={passkey.id}>
              <FingerprintIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-content-subtle"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-body-small text-content-strong">
                  {passkey.name || t('passkeyUnnamed')}
                </span>
                <span className="text-caption text-content">
                  {t('passkeyCreated', {
                    date: new Date(passkey.createdAt).toLocaleDateString(locale),
                  })}
                </span>
              </div>
              <Button
                aria-label={t('passkeyRemove')}
                disabled={busy}
                onClick={() => removePasskey(passkey.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <TrashIcon aria-hidden="true" />
              </Button>
            </SettingsListItem>
          ))}
        </SettingsList>
      ) : (
        <SettingsHint>{t('passkeyEmpty')}</SettingsHint>
      )}
    </SettingsSection>
  )
}

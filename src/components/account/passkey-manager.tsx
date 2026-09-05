'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { FingerprintIcon, TrashIcon } from '@/components/icons'
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-content-strong text-heading-medium">
          {t('passkeyTitle')}
        </h2>
        <p className="text-body-small text-content">{t('passkeyHint')}</p>
      </div>

      {isPending ? null : passkeys && passkeys.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li
              className="flex items-center gap-3 rounded-large border border-line px-3 py-2"
              key={passkey.id}
            >
              <FingerprintIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-content-subtle"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-small text-content-strong">
                  {passkey.name || t('passkeyUnnamed')}
                </span>
                <span className="text-caption text-content-subtle">
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-small text-content-subtle">
          {t('passkeyEmpty')}
        </p>
      )}

      <Button
        aria-busy={busy}
        className="w-full tablet:w-auto tablet:self-start"
        disabled={busy}
        onClick={addPasskey}
        type="button"
        variant="secondary"
      >
        {t('passkeyAdd')}
      </Button>
    </section>
  )
}

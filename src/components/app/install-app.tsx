'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { CancelIcon, DownloadIcon, ShareIcon } from '@/components/icons'
import { PlusIcon } from '@/components/icons/outline'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from '@/components/ui/sheet'
import { readStoredValue, writeStoredValue } from '@/shared/storage'
import { useInstallPrompt } from '@/shared/hooks/use-install-prompt'

type GuideState = Readonly<{ open: boolean; safari: boolean }>

const dismissedKey = 'leaf:install-banner-dismissed'
const closedGuide: GuideState = { open: false, safari: false }

let guideState: GuideState = closedGuide
const guideListeners = new Set<() => void>()

function notifyGuide() {
  for (const listener of guideListeners) {
    listener()
  }
}

function subscribeGuide(listener: () => void) {
  guideListeners.add(listener)

  return () => {
    guideListeners.delete(listener)
  }
}

export function openInstallGuide(safari: boolean) {
  guideState = { open: true, safari }
  notifyGuide()
}

function closeInstallGuide() {
  guideState = { ...guideState, open: false }
  notifyGuide()
}

export function useInstallAction() {
  const { offer, install } = useInstallPrompt()

  const act = useCallback(async () => {
    if (offer === 'prompt') {
      await install()
      return
    }

    if (offer === 'ios-safari' || offer === 'ios-browser') {
      const safari = offer === 'ios-safari'

      requestAnimationFrame(() => openInstallGuide(safari))
    }
  }, [offer, install])

  return { offer, act }
}

export function InstallGuide() {
  const t = useTranslations('install')
  const { open, safari } = useSyncExternalStore(
    subscribeGuide,
    () => guideState,
    () => closedGuide,
  )

  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) {
          closeInstallGuide()
        }
      }}
      open={open}
    >
      <SheetContent className="pb-8" side="bottom">
        <SheetHeader
          subtitle={safari ? t('iosSafariSubtitle') : t('iosBrowserSubtitle')}
          title={t('iosTitle')}
          type="close"
        />
        {safari ? (
          <ol className="flex flex-col gap-4 px-5 pt-5">
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-large bg-surface-hover text-content-strong">
                <ShareIcon aria-hidden="true" className="size-4" />
              </span>
              <span className="text-content-strong text-sm">{t('iosStepShare')}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-large bg-surface-hover text-content-strong">
                <PlusIcon aria-hidden="true" className="size-4" />
              </span>
              <span className="text-content-strong text-sm">{t('iosStepAdd')}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-large bg-surface-hover text-content-strong">
                <DownloadIcon aria-hidden="true" className="size-4" />
              </span>
              <span className="text-content-strong text-sm">{t('iosStepConfirm')}</span>
            </li>
          </ol>
        ) : (
          <p className="px-5 pt-5 text-content-subtle text-sm">{t('iosBrowserBody')}</p>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function InstallBanner() {
  const t = useTranslations('install')
  const { offer, act } = useInstallAction()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(readStoredValue(dismissedKey, false))
  }, [])

  function dismiss() {
    setDismissed(true)
    writeStoredValue(dismissedKey, true)
  }

  if (dismissed || offer === 'none') {
    return null
  }

  return (
    <div
      className="flex items-center gap-3 border-line border-b bg-surface-nav px-4 py-2.5 tablet:hidden"
      data-testid="install-banner"
    >
      <DownloadIcon aria-hidden="true" className="size-4 shrink-0 text-content-subtle" />
      <p className="min-w-0 flex-1 text-content-strong text-sm">{t('bannerBody')}</p>
      <Button onClick={() => void act()} size="sm" variant="secondary">
        {t('bannerAction')}
      </Button>
      <ButtonIcon aria-label={t('bannerDismiss')} onClick={dismiss} size="small" variant="ghost">
        <CancelIcon aria-hidden="true" className="size-4" />
      </ButtonIcon>
    </div>
  )
}

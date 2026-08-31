'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { openCommandPalette } from '@/components/app/palette-bridge'
import {
  isMacPlatform,
  primaryShortcutLabel,
} from '@/components/app/palette-shortcut'
import { SearchIcon } from '@/components/icons'

export function CommandPaletteTrigger() {
  const t = useTranslations('palette')
  const [mac, setMac] = useState(false)

  useEffect(() => {
    setMac(isMacPlatform(window.navigator.userAgent))
  }, [])

  return (
    <button
      aria-keyshortcuts="Meta+K Control+K Alt+K"
      className="flex h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-large border border-line-strong bg-surface-card px-3 text-body-small text-content transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
      data-testid="command-palette-trigger"
      onClick={() => openCommandPalette()}
      type="button"
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{t('trigger')}</span>
      <kbd className="hidden shrink-0 rounded-small border border-line-muted bg-surface-subtle px-1.5 py-0.5 font-sans text-caption text-content tablet:inline">
        {primaryShortcutLabel(mac)}
      </kbd>
    </button>
  )
}

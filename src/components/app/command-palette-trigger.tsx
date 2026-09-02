'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { openCommandPalette } from '@/components/app/palette-bridge'
import {
  isMacPlatform,
  primaryShortcutLabel,
} from '@/components/app/palette-shortcut'
import { SearchIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

export function CommandPaletteTrigger() {
  const t = useTranslations('palette')
  const [mac, setMac] = useState(false)

  useEffect(() => {
    setMac(isMacPlatform(window.navigator.userAgent))
  }, [])

  return (
    <button
      aria-keyshortcuts="Meta+K Control+K Alt+K"
      className={cn(
        'flex h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-xlarge border border-line-muted bg-surface-card px-2 text-left text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 tablet:h-8',
      )}
      data-testid="command-palette-trigger"
      onClick={() => openCommandPalette()}
      type="button"
    >
      <SearchIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-content-subtle"
      />
      <span className="min-w-0 flex-1 truncate">{t('trigger')}</span>
      <kbd className="hidden shrink-0 font-sans text-caption text-content-disabled tablet:inline">
        {primaryShortcutLabel(mac)}
      </kbd>
    </button>
  )
}

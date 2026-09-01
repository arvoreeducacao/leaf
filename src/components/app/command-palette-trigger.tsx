'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { openCommandPalette } from '@/components/app/palette-bridge'
import {
  isMacPlatform,
  primaryShortcutLabel,
} from '@/components/app/palette-shortcut'
import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
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
      className={cn(sidebarRow, 'group/row cursor-pointer')}
      data-testid="command-palette-trigger"
      onClick={() => openCommandPalette()}
      type="button"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <SearchIcon aria-hidden="true" className={sidebarIcon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{t('trigger')}</span>
      <kbd className="hidden shrink-0 font-sans text-caption text-content-disabled opacity-0 transition-opacity group-hover/row:opacity-100 tablet:inline">
        {primaryShortcutLabel(mac)}
      </kbd>
    </button>
  )
}

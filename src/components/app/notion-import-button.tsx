'use client'

import { useTranslations } from 'next-intl'

import { requestNotionImport } from '@/components/app/palette-bridge'
import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { ArchiveDownloadIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

type Props = Readonly<{ onNavigate?: () => void }>

export function NotionImportButton({ onNavigate }: Props) {
  const t = useTranslations('notionImport')

  return (
    <button
      className={cn(sidebarRow, 'cursor-pointer')}
      data-testid="sidebar-notion-import"
      onClick={() => {
        onNavigate?.()
        requestNotionImport()
      }}
      type="button"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <ArchiveDownloadIcon aria-hidden="true" className={sidebarIcon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{t('sidebarAction')}</span>
    </button>
  )
}

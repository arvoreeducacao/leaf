'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { EllipsisIcon } from '@/components/icons/outline'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  hidden: number
  href: string
  onNavigate?: () => void
}>

export function SidebarOverflowLink({ hidden, href, onNavigate }: Props) {
  const t = useTranslations('nav')

  if (hidden <= 0) {
    return null
  }

  return (
    <Link
      className={cn(sidebarRow, 'pl-1.5 text-content-subtle')}
      href={href}
      onClick={onNavigate}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <EllipsisIcon aria-hidden="true" className={sidebarIcon} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {t('showAll', { count: hidden })}
      </span>
    </Link>
  )
}

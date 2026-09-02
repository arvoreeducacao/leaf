'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  sidebarEmpty,
  sidebarIcon,
  sidebarRow,
  sidebarRowActive,
} from '@/components/app/sidebar-styles'
import { PageIcon } from '@/components/icons/outline'
import type { DocumentMatch } from '@/lib/document-search'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  matches: Array<DocumentMatch>
  onNavigate?: () => void
}>

export function DocumentSearchResults({ matches, onNavigate }: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()

  if (matches.length === 0) {
    return <p className={sidebarEmpty}>{t('searchEmpty')}</p>
  }

  return (
    <ul className="flex flex-col">
      {matches.map((match) => {
        const active = pathname === `/doc/${match.id}`
        const hint = match.shared ? t('sharedBadge') : match.path

        return (
          <li key={`${match.shared ? 'shared' : 'owned'}-${match.id}`}>
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                sidebarRow,
                'h-auto min-h-11 items-start py-1 pl-1.5 tablet:h-auto tablet:min-h-7',
                active && sidebarRowActive,
              )}
              href={`/doc/${match.id}`}
              onClick={onNavigate}
            >
              <span className="flex h-5 size-5 shrink-0 items-center justify-center">
                <PageIcon aria-hidden="true" className={sidebarIcon} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{match.title}</span>
                {hint ? (
                  <span className="truncate text-caption text-content-subtle">
                    {hint}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

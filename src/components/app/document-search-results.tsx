'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { PageIcon } from '@/components/icons'
import type { DocumentMatch } from '@/lib/document-search'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  matches: Array<DocumentMatch>
  onNavigate?: () => void
}>

export function DocumentSearchResults({ matches, onNavigate }: Props) {
  const pathname = usePathname()

  if (matches.length === 0) {
    return (
      <p className="px-3 py-2 text-body-small text-gray-700">
        Nenhum documento com esse nome
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {matches.map((match) => {
        const active = pathname === `/doc/${match.id}`

        return (
          <li key={`${match.shared ? 'shared' : 'owned'}-${match.id}`}>
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-large px-3 py-2 text-body-small transition-colors',
                'focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2',
                active
                  ? 'bg-primary-100 font-bold text-gray-900'
                  : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900',
              )}
              href={`/doc/${match.id}`}
              onClick={onNavigate}
            >
              <PageIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{match.title}</span>
                {match.path ? (
                  <span className="truncate text-caption text-gray-700">
                    {match.path}
                  </span>
                ) : null}
                {match.shared ? (
                  <span className="truncate text-caption text-gray-700">
                    Compartilhado comigo
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

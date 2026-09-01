'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  sidebarEmpty,
  sidebarIcon,
  sidebarRow,
  sidebarRowActive,
} from '@/components/app/sidebar-styles'
import { PageIcon } from '@/components/icons'
import type { DocumentSummary } from '@/lib/documents'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documents: Array<DocumentSummary>
  emptyLabel: string
  onNavigate?: () => void
}>

export function DocumentList({ documents, emptyLabel, onNavigate }: Props) {
  const pathname = usePathname()

  if (documents.length === 0) {
    return <p className={sidebarEmpty}>{emptyLabel}</p>
  }

  return (
    <ul className="flex flex-col">
      {documents.map((document) => {
        const active = pathname === `/doc/${document.id}`

        return (
          <li key={document.id}>
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                sidebarRow,
                'pl-1.5',
                active && sidebarRowActive,
              )}
              href={`/doc/${document.id}`}
              onClick={onNavigate}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                <PageIcon aria-hidden="true" className={sidebarIcon} />
              </span>
              <span className="min-w-0 flex-1 truncate">{document.title}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

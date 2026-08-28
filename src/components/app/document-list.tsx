'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    return (
      <p className="px-3 py-2 text-body-small text-gray-700">
        {emptyLabel}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {documents.map((document) => {
        const active = pathname === `/doc/${document.id}`

        return (
          <li key={document.id}>
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-large px-3 py-2 text-body-small  transition-colors',
                'focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2',
                active
                  ? 'bg-primary-100 font-bold text-gray-900'
                  : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900',
              )}
              href={`/doc/${document.id}`}
              onClick={onNavigate}
            >
              <PageIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{document.title}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

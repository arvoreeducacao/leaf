'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { DocumentRowMenu } from '@/components/app/document-row-menu'
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
  hasOrganization: boolean
  onNavigate?: () => void
}>

export function DocumentList({
  documents,
  emptyLabel,
  hasOrganization,
  onNavigate,
}: Props) {
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
            <DocumentRowMenu
              className={cn(
                sidebarRow,
                'group/row gap-1 pl-1.5',
                active && sidebarRowActive,
              )}
              documentId={document.id}
              hasOrganization={hasOrganization}
              owned={document.owned}
              title={document.title}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                <PageIcon aria-hidden="true" className={sidebarIcon} />
              </span>
              <Link
                aria-current={active ? 'page' : undefined}
                className="flex h-full min-w-0 flex-1 items-center truncate rounded-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                href={`/doc/${document.id}`}
                onClick={onNavigate}
              >
                <span className="min-w-0 flex-1 truncate">{document.title}</span>
              </Link>
            </DocumentRowMenu>
          </li>
        )
      })}
    </ul>
  )
}

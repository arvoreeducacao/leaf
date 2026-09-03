'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { DocumentRowMenu } from '@/components/app/document-row-menu'
import {
  sidebarEmpty,
  sidebarIcon,
  sidebarRow,
  sidebarRowActive,
} from '@/components/app/sidebar-styles'
import { EllipsisIcon } from '@/components/icons/outline'
import type { DocumentSummary } from '@/lib/documents'
import { cn } from '@/shared/utils'

const collapsedCount = 5

type Props = Readonly<{
  documents: Array<DocumentSummary>
  hasOrganization: boolean
  onNavigate?: () => void
}>

export function RecentDocuments({
  documents,
  hasOrganization,
  onNavigate,
}: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  if (documents.length === 0) {
    return <p className={sidebarEmpty}>{t('emptyRecents')}</p>
  }

  const visible = expanded ? documents : documents.slice(0, collapsedCount)

  return (
    <>
      <ul className="flex flex-col">
        {visible.map((document) => {
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
                  <DocumentIcon
                    className={sidebarIcon}
                    icon={document.icon}
                    kind={document.kind === 'row' ? 'page' : document.kind}
                  />
                </span>
                <Link
                  aria-current={active ? 'page' : undefined}
                  className="flex h-full min-w-0 flex-1 items-center truncate rounded-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                  href={`/doc/${document.id}`}
                  onClick={onNavigate}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {document.title}
                  </span>
                </Link>
              </DocumentRowMenu>
            </li>
          )
        })}
      </ul>

      {documents.length > collapsedCount ? (
        <button
          aria-expanded={expanded}
          className={cn(sidebarRow, 'cursor-pointer pl-1.5 text-content-subtle')}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <EllipsisIcon aria-hidden="true" className={sidebarIcon} />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {expanded ? t('less') : t('more')}
          </span>
        </button>
      ) : null}
    </>
  )
}

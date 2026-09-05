'use client'

import { useTranslations } from 'next-intl'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import type { DatabaseProperty } from '@/db/schema'
import type { Person } from '@/lib/database/people'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { CardProperties } from './card-properties'
import { PlusIcon } from './icons'
import { RowContextMenu, RowMenu } from './row-menu'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
  showPageIcon: boolean
  handlers: DatabaseHandlers
  people: ReadonlyArray<Person>
  compact?: boolean
}>

export function ListView({
  rows,
  properties,
  canEdit,
  showPageIcon,
  handlers,
  people,
  compact = false,
}: Props) {
  const t = useTranslations('database')

  return (
    <div className={cn('flex flex-col', compact ? '' : 'px-4 tablet:px-24')}>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const title = row.title.trim().length > 0 ? row.title : t('untitledRow')

          return (
            <li className="border-line-divider border-b" key={row.id}>
              <RowContextMenu
                canEdit={canEdit}
                onDelete={() => handlers.deleteRow(row.id)}
                rowId={row.id}
                title={row.title}
              >
                <div className="group/row flex min-h-11 items-center gap-2 rounded-medium px-2 transition-colors hover:bg-surface-hover">
                  <Link
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-medium font-medium text-body-small text-content-strong transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                    href={`/doc/${row.id}`}
                  >
                    {showPageIcon ? (
                      <DocumentIcon
                        className="size-4 shrink-0 text-content-subtle"
                        icon={row.icon}
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{title}</span>
                  </Link>
                  <CardProperties
                    className="hidden shrink-0 flex-row items-center gap-3 tablet:flex"
                    people={people}
                    properties={properties}
                    row={row}
                    showIcons={false}
                  />
                  <div className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                    <RowMenu
                      canEdit={canEdit}
                      onDelete={() => handlers.deleteRow(row.id)}
                      rowId={row.id}
                      title={row.title}
                    />
                  </div>
                </div>
              </RowContextMenu>
            </li>
          )
        })}
      </ul>

      {canEdit ? (
        <button
          className="flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-large px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
          onClick={() => handlers.createRow()}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          {t('newRow')}
        </button>
      ) : null}
    </div>
  )
}

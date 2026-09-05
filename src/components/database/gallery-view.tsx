'use client'

import { useTranslations } from 'next-intl'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import type { DatabaseProperty } from '@/db/schema'
import { gradientOfCover } from '@/lib/document-cover'
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

function Cover({
  cover,
  preview,
}: Readonly<{ cover: string | null; preview: string | null }>) {
  const gradient = gradientOfCover(cover)

  if (gradient) {
    return (
      <span
        aria-hidden="true"
        className="block h-28 w-full"
        style={{ background: gradient.css }}
      />
    )
  }

  const image = cover ?? preview

  if (image) {
    return (
      <img
        alt=""
        className="block h-28 w-full object-cover"
        draggable={false}
        src={image}
      />
    )
  }

  return <span aria-hidden="true" className="block h-28 w-full bg-surface-subtle" />
}

export function GalleryView({
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
    <div className={cn('flex flex-col gap-2', compact ? '' : 'px-4 tablet:px-24')}>
      <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-3 desktop:grid-cols-4">
        {rows.map((row) => {
          const title = row.title.trim().length > 0 ? row.title : t('untitledRow')

          return (
            <li key={row.id}>
              <RowContextMenu
                canEdit={canEdit}
                onDelete={() => handlers.deleteRow(row.id)}
                rowId={row.id}
                title={row.title}
              >
                <article className="group/card flex h-full flex-col overflow-hidden rounded-large border border-line bg-surface-card shadow-down-small transition-colors hover:border-line-strong">
                  <Cover cover={row.cover} preview={row.preview} />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start gap-1">
                      <Link
                        className="flex min-w-0 flex-1 items-start gap-1.5 rounded-medium font-bold text-body-small text-content-strong transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                        href={`/doc/${row.id}`}
                      >
                        {showPageIcon ? (
                          <DocumentIcon
                            className="mt-0.5 size-4 shrink-0 text-content-subtle"
                            icon={row.icon}
                          />
                        ) : null}
                        <span className="min-w-0 break-words">{title}</span>
                      </Link>
                      <div className="shrink-0 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
                        <RowMenu
                          canEdit={canEdit}
                          onDelete={() => handlers.deleteRow(row.id)}
                          rowId={row.id}
                          title={row.title}
                        />
                      </div>
                    </div>
                    <CardProperties
                      people={people}
                      properties={properties}
                      row={row}
                    />
                  </div>
                </article>
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

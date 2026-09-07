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

const coverHeight = 'h-[146px]'

const cardRing =
  'shadow-[0_0_0_1px_var(--color-line),0_2px_4px_rgba(15,15,15,0.06)]'

function Cover({
  cover,
  preview,
}: Readonly<{ cover: string | null; preview: string | null }>) {
  const gradient = gradientOfCover(cover)

  if (gradient) {
    return (
      <span
        aria-hidden="true"
        className={cn('block w-full', coverHeight)}
        style={{ background: gradient.css }}
      />
    )
  }

  const image = cover ?? preview

  if (image) {
    return (
      <img
        alt=""
        className={cn('block w-full object-cover', coverHeight)}
        draggable={false}
        src={image}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn('block w-full bg-surface-subtle', coverHeight)}
    />
  )
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
    <div className={compact ? undefined : 'px-4 tablet:px-24'}>
      <ul
        className={cn(
          'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-1',
          compact ? 'pt-3' : 'pt-4',
        )}
      >
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
                <article
                  className={cn(
                    'group/card flex h-full flex-col overflow-hidden rounded-xlarge bg-surface-card transition-colors hover:bg-surface-hover',
                    cardRing,
                  )}
                >
                  <Cover cover={row.cover} preview={row.preview} />
                  <div className="flex flex-1 flex-col pb-2">
                    <div className="flex items-center gap-1 px-2.5 pt-2 pb-1.5">
                      <Link
                        className="flex min-w-0 flex-1 items-center rounded-medium font-medium text-[15px] text-content-strong leading-normal focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                        href={`/doc/${row.id}`}
                      >
                        {showPageIcon ? (
                          <DocumentIcon
                            className="-ml-0.5 mr-1 size-5 shrink-0 text-[18px] text-content-subtle"
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
                      className="px-[11px]"
                      people={people}
                      properties={properties}
                      row={row}
                      showIcons={false}
                      small
                    />
                  </div>
                </article>
              </RowContextMenu>
            </li>
          )
        })}

        {canEdit ? (
          <li>
            <button
              className={cn(
                'flex h-10 w-full cursor-pointer items-center justify-center gap-1 rounded-xlarge px-3.5 text-[15px] text-content-subtle transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
                cardRing,
              )}
              onClick={() => handlers.createRow()}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {t('newRow')}
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

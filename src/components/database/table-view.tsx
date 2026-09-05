'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { ArrowExpandIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import { valueOf } from '@/lib/database/values'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { AddPropertyMenu } from './add-property-menu'
import { PlusIcon, TextTypeIcon } from './icons'
import { PropertyCell } from './property-cell'
import { PropertyHeader } from './property-header'
import { RowContextMenu, RowMenu } from './row-menu'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
  wrap: boolean
  verticalLines: boolean
  showPageIcon: boolean
  handlers: DatabaseHandlers
  people: ReadonlyArray<Person>
  compact?: boolean
}>

const cellFrame = 'border-line-divider border-b p-0'

function RowTitle({
  rowId,
  title,
  label,
  placeholder,
  wrap,
  onRename,
}: Readonly<{
  rowId: string
  title: string
  label: string
  placeholder: string
  wrap: boolean
  onRename: (value: string) => void
}>) {
  const [draft, setDraft] = useState(title)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(title)
  }, [title])

  useEffect(() => {
    const element = area.current

    if (!element) {
      return
    }

    if (!wrap) {
      element.style.removeProperty('height')

      return
    }

    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [draft, wrap])

  return (
    <textarea
      aria-label={label}
      className={cn(
        'w-full min-w-0 resize-none overflow-hidden bg-transparent font-regular text-body-small text-content-strong outline-none transition-colors placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
        wrap ? 'break-words' : 'h-5 truncate whitespace-nowrap',
      )}
      key={rowId}
      onBlur={() => onRename(draft)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      ref={area}
      rows={1}
      value={draft}
    />
  )
}

export function TableView({
  rows,
  properties,
  canEdit,
  wrap,
  verticalLines,
  showPageIcon,
  handlers,
  people,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const gutter = compact ? '' : 'pl-4 tablet:pl-24'
  const columnLine = verticalLines ? 'border-line-divider border-r' : ''
  const bodyCell = cn(
    cellFrame,
    columnLine,
    wrap ? 'align-top' : 'align-middle',
  )
  const bodyFrame = wrap ? 'min-h-9 items-start py-1.5' : 'h-9 items-center'

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <div className={cn('relative w-max min-w-full', gutter)}>
          <table className="min-w-max border-collapse text-body-small">
            <thead>
              <tr>
                <th
                  className={cn(cellFrame, columnLine, 'w-70 border-t-0')}
                  scope="col"
                >
                  <div className="flex h-9 w-70 min-w-0 items-center gap-1.5 px-2 font-regular text-content-subtle">
                    <TextTypeIcon
                      aria-hidden="true"
                      className="size-5 shrink-0"
                    />
                    <span className="min-w-0 truncate">{t('titleColumn')}</span>
                  </div>
                </th>
                {properties.map((property) => (
                  <th
                    className={cn(cellFrame, columnLine, 'w-50')}
                    key={property.id}
                    scope="col"
                  >
                    <div className="group/head flex h-9 w-50 min-w-0 items-center px-2 font-regular text-content-subtle">
                      <PropertyHeader
                        canEdit={canEdit}
                        onChangePrefix={(prefix) =>
                          handlers.changeUniqueIdPrefix(property.id, prefix)
                        }
                        onChangeType={(type) =>
                          handlers.changePropertyType(property.id, type)
                        }
                        onDelete={() => handlers.deleteProperty(property.id)}
                        onHide={() => handlers.hideProperty(property.id)}
                        onRename={(name) =>
                          handlers.renameProperty(property.id, name)
                        }
                        property={property}
                      />
                    </div>
                  </th>
                ))}
                <th
                  className="w-32 border-line-divider border-b p-0"
                  scope="col"
                >
                  <div className="flex h-9 items-center px-1">
                    <span className="sr-only">{t('addProperty')}</span>
                    {canEdit ? (
                      <AddPropertyMenu
                        hasOrganization={people.length > 0}
                        onAdd={handlers.addProperty}
                      />
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RowContextMenu
                  canEdit={canEdit}
                  key={row.id}
                  onDelete={() => handlers.deleteRow(row.id)}
                  rowId={row.id}
                  title={row.title}
                >
                  <tr className="group/row">
                    <th
                      className={cn(
                        bodyCell,
                        'relative text-left font-regular transition-colors group-hover/row:bg-surface-hover',
                      )}
                      scope="row"
                    >
                      <div className={cn('flex gap-1 px-2', bodyFrame)}>
                        {showPageIcon ? (
                          <Link
                            aria-hidden="true"
                            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-medium transition-colors hover:bg-surface-hover"
                            href={`/doc/${row.id}`}
                            tabIndex={-1}
                          >
                            <DocumentIcon
                              className="size-4 text-content-subtle"
                              icon={row.icon}
                            />
                          </Link>
                        ) : null}
                        {canEdit ? (
                          <RowTitle
                            label={t('rowTitleLabel')}
                            onRename={(value) =>
                              handlers.renameRow(row.id, value)
                            }
                            placeholder={t('untitledRow')}
                            rowId={row.id}
                            title={row.title}
                            wrap={wrap}
                          />
                        ) : (
                          <Link
                            className={cn(
                              'w-full min-w-0 cursor-pointer font-regular text-body-small text-content-strong transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
                              wrap ? 'break-words' : 'truncate',
                            )}
                            href={`/doc/${row.id}`}
                          >
                            {row.title.trim().length > 0
                              ? row.title
                              : t('untitledRow')}
                          </Link>
                        )}
                      </div>
                      <span className="pointer-events-none absolute top-1 right-1 bg-surface-app opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                        <span className="pointer-events-auto flex items-center gap-1 pl-1 transition-colors group-hover/row:bg-surface-hover">
                          <Link
                            className="flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-large border border-line-strong bg-surface-card px-1.5 font-medium text-caption text-content uppercase transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
                            href={`/doc/${row.id}`}
                          >
                            <ArrowExpandIcon
                              aria-hidden="true"
                              className="size-3"
                            />
                            {t('openRowShort')}
                          </Link>
                          <RowMenu
                            canEdit={canEdit}
                            onDelete={() => handlers.deleteRow(row.id)}
                            rowId={row.id}
                            title={row.title}
                          />
                        </span>
                      </span>
                    </th>
                    {properties.map((property) => (
                      <td
                        className={cn(
                          bodyCell,
                          'transition-colors group-hover/row:bg-surface-hover',
                        )}
                        key={property.id}
                      >
                        <PropertyCell
                          compact
                          onCommit={(value) =>
                            handlers.commitValue(row.id, property.id, value)
                          }
                          onCreateOption={(name) =>
                            handlers.createOption(property.id, name)
                          }
                          people={people}
                          property={property}
                          readOnly={!canEdit}
                          rowTitle={
                            row.title.trim().length > 0
                              ? row.title
                              : t('untitledRow')
                          }
                          value={valueOf(
                            row.values,
                            property,
                            optionsFor(property, people),
                          )}
                          wrap={wrap}
                        />
                      </td>
                    ))}
                    <td className="w-32 border-line-divider border-b transition-colors group-hover/row:bg-surface-hover" />
                  </tr>
                </RowContextMenu>
              ))}
            </tbody>
          </table>

          {canEdit ? (
            <button
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-large px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
              onClick={() => handlers.createRow()}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              {t('newRow')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

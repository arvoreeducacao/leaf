'use client'

import { useTranslations } from 'next-intl'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { AddIcon, ArrowExpandIcon, FormatTextIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import { valueOf } from '@/lib/database/values'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { AddPropertyMenu } from './add-property-menu'
import { PropertyCell } from './property-cell'
import { PropertyHeader } from './property-header'
import { RowContextMenu, RowMenu } from './row-menu'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
  handlers: DatabaseHandlers
  people: ReadonlyArray<Person>
  compact?: boolean
}>

const cellFrame = 'border-line-divider border-r border-b p-0 align-middle'

export function TableView({
  rows,
  properties,
  canEdit,
  handlers,
  people,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const gutter = compact ? '' : 'pl-4 tablet:pl-24'

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <div className={cn('relative w-max min-w-full', gutter)}>
          <table className="min-w-max border-collapse text-body-small">
            <thead>
              <tr>
                <th
                  className={cn(cellFrame, 'w-70 border-t-0 border-l-0')}
                  scope="col"
                >
                  <div className="flex h-9 w-70 min-w-0 items-center gap-1.5 px-2 font-regular text-content-subtle">
                    <FormatTextIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 truncate">{t('titleColumn')}</span>
                  </div>
                </th>
                {properties.map((property) => (
                  <th
                    className={cn(cellFrame, 'w-50')}
                    key={property.id}
                    scope="col"
                  >
                    <div className="group/head flex h-9 w-50 min-w-0 items-center px-2 font-regular text-content-subtle">
                      <PropertyHeader
                        canEdit={canEdit}
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
                <th className="w-32 border-line-divider border-b p-0" scope="col">
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
                        cellFrame,
                        'border-l-0 text-left font-regular transition-colors group-hover/row:bg-surface-hover',
                      )}
                      scope="row"
                    >
                      <div className="flex h-9 items-center gap-1 px-2">
                        <DocumentIcon
                          className="size-4 text-content-subtle"
                          icon={row.icon}
                        />
                        <input
                          aria-label={t('rowTitleLabel')}
                          className="h-full w-full min-w-0 bg-transparent font-regular text-body-small text-content-strong outline-none transition-colors placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2 disabled:text-content"
                          defaultValue={row.title}
                          disabled={!canEdit}
                          key={`${row.id}-${row.title}`}
                          onBlur={(event) =>
                            handlers.renameRow(row.id, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                          placeholder={t('untitledRow')}
                        />
                        <Link
                          className="hidden h-6 shrink-0 cursor-pointer items-center gap-1 rounded-large px-1.5 font-medium text-caption text-content uppercase transition-colors hover:bg-surface-hover hover:text-content-strong group-hover/row:inline-flex focus-visible:inline-flex focus-visible:outline-2 focus-visible:outline-focus"
                          href={`/doc/${row.id}`}
                        >
                          <ArrowExpandIcon aria-hidden="true" className="size-3.5" />
                          {t('openRowShort')}
                        </Link>
                        <div className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                          <RowMenu
                            canEdit={canEdit}
                            onDelete={() => handlers.deleteRow(row.id)}
                            rowId={row.id}
                            title={row.title}
                          />
                        </div>
                      </div>
                    </th>
                    {properties.map((property) => (
                      <td
                        className={cn(
                          cellFrame,
                          'transition-colors group-hover/row:bg-surface-hover',
                        )}
                        key={property.id}
                      >
                        <div className="flex h-9 items-center px-2">
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
                          />
                        </div>
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
              <AddIcon aria-hidden="true" className="size-4" />
              {t('newRow')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

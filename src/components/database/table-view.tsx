'use client'

import { useTranslations } from 'next-intl'

import { AddIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { parseOptions, valueOf } from '@/lib/database/values'
import type { DatabaseRow } from '@/lib/database/views'

import { AddPropertyMenu } from './add-property-menu'
import { PropertyCell } from './property-cell'
import { PropertyHeader } from './property-header'
import { RowMenu } from './row-menu'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
  handlers: DatabaseHandlers
}>

export function TableView({ rows, properties, canEdit, handlers }: Props) {
  const t = useTranslations('database')

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-body-small">
          <thead>
            <tr className="border-line-divider border-b">
              <th
                className="min-w-56 px-2 py-2 text-left font-bold text-content"
                scope="col"
              >
                {t('titleColumn')}
              </th>
              {properties.map((property) => (
                <th
                  className="min-w-40 px-2 py-2 text-left font-bold text-content"
                  key={property.id}
                  scope="col"
                >
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
                </th>
              ))}
              <th className="w-12 px-1 py-2" scope="col">
                <span className="sr-only">{t('addProperty')}</span>
                {canEdit ? (
                  <AddPropertyMenu onAdd={handlers.addProperty} />
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="border-line-divider border-b transition-colors hover:bg-surface-hover/60"
                key={row.id}
              >
                <th
                  className="px-2 py-1 text-left font-regular"
                  scope="row"
                >
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={t('rowTitleLabel')}
                      className="h-9 w-full min-w-0 rounded-medium bg-transparent px-2 font-bold text-body-small text-content-strong outline-none transition-colors placeholder:font-regular placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2 disabled:text-content"
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
                    <RowMenu
                      canEdit={canEdit}
                      onDelete={() => handlers.deleteRow(row.id)}
                      rowId={row.id}
                      title={row.title}
                    />
                  </div>
                </th>
                {properties.map((property) => (
                  <td className="px-2 py-1" key={property.id}>
                    <PropertyCell
                      compact
                      onCommit={(value) =>
                        handlers.commitValue(row.id, property.id, value)
                      }
                      onCreateOption={(name) =>
                        handlers.createOption(property.id, name)
                      }
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
                        parseOptions(property.options),
                      )}
                    />
                  </td>
                ))}
                <td className="w-12" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-body-small text-content">
          {t('noRows')}{' '}
          <span className="text-content-subtle">{t('noRowsHint')}</span>
        </p>
      ) : null}

      {canEdit ? (
        <button
          className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-medium px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
          onClick={() => handlers.createRow()}
          type="button"
        >
          <AddIcon aria-hidden="true" className="size-4" />
          {t('newRow')}
        </button>
      ) : null}
    </div>
  )
}

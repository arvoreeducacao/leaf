'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import type { DatabaseProperty } from '@/db/schema'
import { addSelectOption, setDatabaseRowValue } from '@/lib/database-actions'
import {
  type PropertyValue,
  type SelectOption,
  parseOptions,
  serializeOptions,
  valueOf,
} from '@/lib/database/values'
import type { DatabaseRow } from '@/lib/database/views'

import { PropertyCell } from './property-cell'
import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  row: DatabaseRow
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
}>

export function RowProperties({ row, properties, canEdit }: Props) {
  const t = useTranslations('database')
  const [items, setItems] = useState(properties)
  const [values, setValues] = useState(row.values)

  if (items.length === 0) {
    return null
  }

  function commit(propertyId: string, value: PropertyValue) {
    setValues((current) => ({ ...current, [propertyId]: value }))

    void (async () => {
      try {
        const result = await setDatabaseRowValue(row.id, propertyId, value)

        if (!result.ok) {
          toast.error(result.error)
        }
      } catch {
        toast.error(t('saveFailed'))
      }
    })()
  }

  async function createOption(
    propertyId: string,
    name: string,
  ): Promise<SelectOption | null> {
    try {
      const result = await addSelectOption(propertyId, name)

      if (!result.ok) {
        toast.error(result.error)

        return null
      }

      setItems((current) =>
        current.map((item) => {
          if (item.id !== propertyId) {
            return item
          }

          const options = parseOptions(item.options)

          if (options.some((option) => option.id === result.option.id)) {
            return item
          }

          return {
            ...item,
            options: serializeOptions([...options, result.option]),
          }
        }),
      )

      return result.option
    } catch {
      toast.error(t('saveFailed'))

      return null
    }
  }

  return (
    <section aria-label={t('rowProperties')} className="flex flex-col gap-1">
      <dl className="flex flex-col gap-1">
        {items.map((property) => (
          <div
            className="flex flex-col gap-1 tablet:flex-row tablet:items-center tablet:gap-3"
            key={property.id}
          >
            <dt className="flex min-w-0 shrink-0 items-center gap-2 text-body-small text-content tablet:w-48">
              <PropertyIcon
                className="size-4 shrink-0 text-content-subtle"
                type={property.type}
              />
              <span className="truncate">{property.name}</span>
            </dt>
            <dd className="min-w-0 flex-1">
              <PropertyCell
                compact
                onCommit={(value) => commit(property.id, value)}
                onCreateOption={(name) => createOption(property.id, name)}
                property={property}
                readOnly={!canEdit}
                rowTitle={
                  row.title.trim().length > 0 ? row.title : t('untitledRow')
                }
                value={valueOf(
                  values,
                  property,
                  parseOptions(property.options),
                )}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

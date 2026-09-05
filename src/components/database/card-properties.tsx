'use client'

import { useLocale } from 'next-intl'

import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import { parseUniqueIdConfig } from '@/lib/database/unique-id'
import { valueOf, valueToText } from '@/lib/database/values'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { PropertyIcon } from './property-icon'
import { OptionChip, PersonChip, StatusChip } from './select-editor'

const chipKinds = ['select', 'multiSelect', 'status', 'person']

type Props = Readonly<{
  row: DatabaseRow
  properties: ReadonlyArray<DatabaseProperty>
  people: ReadonlyArray<Person>
  showIcons?: boolean
  className?: string
}>

export function CardProperties({
  row,
  properties,
  people,
  showIcons = true,
  className,
}: Props) {
  const locale = useLocale()

  return (
    <dl className={cn('flex flex-col gap-1', className)}>
      {properties.map((property) => {
        const options = optionsFor(property, people)
        const value = valueOf(row.values, property, options)
        const text = valueToText(
          value,
          property.type,
          options,
          locale,
          parseUniqueIdConfig(property.options).prefix,
        )

        if (text.length === 0) {
          return null
        }

        const Chip =
          property.type === 'person'
            ? PersonChip
            : property.type === 'status'
              ? StatusChip
              : OptionChip

        return (
          <div className="flex items-center gap-2" key={property.id}>
            <dt className="flex shrink-0 items-center gap-1 text-caption text-content-subtle">
              {showIcons ? (
                <PropertyIcon className="size-3.5" type={property.type} />
              ) : null}
              <span className="sr-only">{property.name}</span>
            </dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-1 truncate text-caption text-content">
              {chipKinds.includes(property.type)
                ? (Array.isArray(value) ? value : [value]).map((id) => {
                    const option = options.find((item) => item.id === id)

                    return option ? (
                      <Chip key={option.id} option={option} />
                    ) : null
                  })
                : text}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

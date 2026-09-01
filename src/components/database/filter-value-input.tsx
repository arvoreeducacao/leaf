'use client'

import { useTranslations } from 'next-intl'

import type { DatabaseProperty } from '@/db/schema'
import { type PropertyValue, parseOptions } from '@/lib/database/values'
import type { FilterOperator } from '@/lib/database/views'
import { operatorNeedsValue } from '@/lib/database/views'

import { FieldSelect } from './field-select'

type Props = Readonly<{
  property: DatabaseProperty | null
  operator: FilterOperator
  value: PropertyValue
  onChange: (value: PropertyValue) => void
}>

export function FilterValueInput({
  property,
  operator,
  value,
  onChange,
}: Props) {
  const t = useTranslations('database')

  if (!operatorNeedsValue(operator)) {
    return null
  }

  const inputClass =
    'h-9 w-full min-w-0 rounded-medium border border-line-strong bg-surface-card px-2 text-body-small text-content-strong outline-none transition-colors hover:border-line-contrast focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

  if (!property) {
    return (
      <input
        aria-label={t('filterValue')}
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={typeof value === 'string' ? value : ''}
      />
    )
  }

  if (property.type === 'checkbox') {
    return (
      <FieldSelect
        className="w-full"
        label={t('filterValue')}
        onChange={(next) => onChange(next === 'true')}
        options={[
          { value: 'true', label: t('checked') },
          { value: 'false', label: t('unchecked') },
        ]}
        value={value === true ? 'true' : 'false'}
      />
    )
  }

  if (property.type === 'select' || property.type === 'multiSelect') {
    const options = parseOptions(property.options)

    return (
      <FieldSelect
        className="w-full"
        label={t('filterValue')}
        onChange={onChange}
        options={[
          { value: '', label: t('selectPlaceholder') },
          ...options.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
        value={typeof value === 'string' ? value : ''}
      />
    )
  }

  if (property.type === 'date') {
    return (
      <input
        aria-label={t('filterValue')}
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={typeof value === 'string' ? value : ''}
      />
    )
  }

  return (
    <input
      aria-label={t('filterValue')}
      className={inputClass}
      inputMode={property.type === 'number' ? 'decimal' : undefined}
      onChange={(event) =>
        onChange(
          property.type === 'number'
            ? event.target.value === ''
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
      type={property.type === 'number' ? 'number' : 'text'}
      value={
        value === null || value === undefined
          ? ''
          : typeof value === 'number'
            ? String(value)
            : typeof value === 'string'
              ? value
              : ''
      }
    />
  )
}

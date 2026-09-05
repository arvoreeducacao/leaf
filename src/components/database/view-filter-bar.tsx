'use client'

import { useLocale, useTranslations } from 'next-intl'

import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CancelIcon,
  CaretDownIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import { parseUniqueIdConfig } from '@/lib/database/unique-id'
import { valueToText } from '@/lib/database/values'
import {
  MAX_FILTERS,
  TITLE_PROPERTY_ID,
  type ViewConfig,
  type ViewFilter,
  type ViewSort,
  operatorNeedsValue,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { FieldSelect } from './field-select'
import { FilterValueInput } from './filter-value-input'
import { PropertyIcon } from './property-icon'
import { PropertyPicker } from './property-picker'

type Props = Readonly<{
  config: ViewConfig
  properties: ReadonlyArray<DatabaseProperty>
  people: ReadonlyArray<Person>
  canEdit: boolean
  hasDraft: boolean
  filtersChanged: boolean
  sortsChanged: boolean
  onConfigChange: (config: ViewConfig) => void
  onReset: () => void
  onPublish: () => void
  compact?: boolean
}>

const chipBase =
  'relative flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-medium px-1.5 text-body-small transition-colors tablet:h-7 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}

function UnsavedDot() {
  return (
    <span
      aria-hidden="true"
      className="-top-0.5 -right-0.5 absolute size-1.5 rounded-circular bg-warn"
    />
  )
}

export function ViewFilterBar({
  config,
  properties,
  people,
  canEdit,
  hasDraft,
  filtersChanged,
  sortsChanged,
  onConfigChange,
  onReset,
  onPublish,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()

  if (config.filters.length === 0 && config.sorts.length === 0 && !hasDraft) {
    return null
  }

  function propertyOf(propertyId: string) {
    return properties.find((property) => property.id === propertyId) ?? null
  }

  function nameOf(propertyId: string) {
    return propertyId === TITLE_PROPERTY_ID
      ? t('titleColumn')
      : (propertyOf(propertyId)?.name ?? t('titleColumn'))
  }

  function describe(filter: ViewFilter): string {
    const property = propertyOf(filter.propertyId)
    const name = nameOf(filter.propertyId)
    const operator = capitalize(t(`operator_${filter.operator}`))

    if (!operatorNeedsValue(filter.operator)) {
      return `${name}: ${operator}`
    }

    const text = property
      ? valueToText(
          filter.value,
          property.type,
          optionsFor(property, people),
          locale,
          parseUniqueIdConfig(property.options).prefix,
        )
      : typeof filter.value === 'string'
        ? filter.value
        : ''

    return text.trim().length === 0 ? name : `${name}: ${operator} ${text}`
  }

  function updateFilter(index: number, next: ViewFilter) {
    onConfigChange({
      ...config,
      filters: config.filters.map((filter, position) =>
        position === index ? next : filter,
      ),
    })
  }

  function removeFilter(index: number) {
    onConfigChange({
      ...config,
      filters: config.filters.filter((_, position) => position !== index),
    })
  }

  function addFilter(propertyId: string) {
    const property = propertyOf(propertyId)
    const allowed = property ? operatorsFor(property.type) : operatorsFor('text')

    onConfigChange({
      ...config,
      filters: [
        ...config.filters,
        { propertyId, operator: allowed[0], value: null },
      ],
    })
  }

  function updateSort(index: number, next: ViewSort) {
    onConfigChange({
      ...config,
      sorts: config.sorts.map((sort, position) =>
        position === index ? next : sort,
      ),
    })
  }

  function removeSort(index: number) {
    onConfigChange({
      ...config,
      sorts: config.sorts.filter((_, position) => position !== index),
    })
  }

  const filterTargets = [
    { value: TITLE_PROPERTY_ID, label: t('titleColumn') },
    ...properties.map((property) => ({
      value: property.id,
      label: property.name,
    })),
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 py-1',
        compact ? '' : 'px-4 tablet:px-24',
      )}
    >
      {config.sorts.map((sort, index) => (
        <Popover key={`sort-${sort.propertyId}-${index}`}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                chipBase,
                'bg-brand-surface text-content-strong hover:bg-brand-surface-strong',
              )}
              type="button"
            >
              {sort.direction === 'asc' ? (
                <ArrowUpIcon aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <ArrowDownIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
              <span className="max-w-52 truncate">
                {nameOf(sort.propertyId)}
              </span>
              <CaretDownIcon
                aria-hidden="true"
                className="size-3 shrink-0 text-content-subtle"
              />
              {sortsChanged ? <UnsavedDot /> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="flex w-72 items-center gap-1 p-2"
          >
            <FieldSelect
              className="flex-1"
              label={t('sorts')}
              onChange={(value) =>
                updateSort(index, { ...sort, propertyId: value })
              }
              options={filterTargets}
              value={sort.propertyId}
            />
            <FieldSelect
              label={t('sorts')}
              onChange={(value) =>
                updateSort(index, {
                  ...sort,
                  direction: value as ViewSort['direction'],
                })
              }
              options={[
                { value: 'asc', label: t('ascending') },
                { value: 'desc', label: t('descending') },
              ]}
              value={sort.direction}
            />
            <ButtonIcon
              aria-label={t('removeSort')}
              onClick={() => removeSort(index)}
              size="medium"
              variant="ghost"
            >
              <CancelIcon aria-hidden="true" />
            </ButtonIcon>
          </PopoverContent>
        </Popover>
      ))}

      {config.filters.map((filter, index) => {
        const property = propertyOf(filter.propertyId)
        const operators =
          filter.propertyId === TITLE_PROPERTY_ID
            ? operatorsFor('text')
            : property
              ? operatorsFor(property.type)
              : operatorsFor('text')
        const settled =
          !operatorNeedsValue(filter.operator) ||
          describe(filter) !== nameOf(filter.propertyId)

        return (
          <Popover key={`filter-${filter.propertyId}-${index}`}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  chipBase,
                  settled
                    ? 'bg-brand-surface text-content-strong hover:bg-brand-surface-strong'
                    : 'text-content hover:bg-surface-hover',
                )}
                type="button"
              >
                <PropertyIcon
                  className="size-3.5 shrink-0 text-content-subtle"
                  type={property?.type ?? 'text'}
                />
                <span className="max-w-64 truncate">{describe(filter)}</span>
                <CaretDownIcon
                  aria-hidden="true"
                  className="size-3 shrink-0 text-content-subtle"
                />
                {filtersChanged ? <UnsavedDot /> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[22rem] p-2">
              <div className="flex items-center gap-1">
                <FieldSelect
                  className="flex-1"
                  label={t('filters')}
                  onChange={(value) => {
                    const next = propertyOf(value)
                    const allowed =
                      value === TITLE_PROPERTY_ID
                        ? operatorsFor('text')
                        : next
                          ? operatorsFor(next.type)
                          : operatorsFor('text')

                    updateFilter(index, {
                      propertyId: value,
                      operator: allowed[0],
                      value: null,
                    })
                  }}
                  options={filterTargets}
                  value={filter.propertyId}
                />
                <FieldSelect
                  className="flex-1"
                  label={t('filters')}
                  onChange={(value) =>
                    updateFilter(index, {
                      ...filter,
                      operator: value as ViewFilter['operator'],
                      value: operatorNeedsValue(value as ViewFilter['operator'])
                        ? filter.value
                        : null,
                    })
                  }
                  options={operators.map((operator) => ({
                    value: operator,
                    label: t(`operator_${operator}`),
                  }))}
                  value={filter.operator}
                />
                <ButtonIcon
                  aria-label={t('removeFilter')}
                  onClick={() => removeFilter(index)}
                  size="medium"
                  variant="ghost"
                >
                  <CancelIcon aria-hidden="true" />
                </ButtonIcon>
              </div>
              <div className="mt-2">
                <FilterValueInput
                  onChange={(value) => updateFilter(index, { ...filter, value })}
                  operator={filter.operator}
                  people={people}
                  property={property}
                  value={filter.value}
                />
              </div>
            </PopoverContent>
          </Popover>
        )
      })}

      <PropertyPicker
        disabled={config.filters.length >= MAX_FILTERS}
        onPick={addFilter}
        placeholder={t('searchProperty')}
        properties={properties}
        titleLabel={t('titleColumn')}
      >
        <button
          className={cn(chipBase, 'text-content-subtle hover:bg-surface-hover')}
          type="button"
        >
          <AddIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {t('addFilterShort')}
        </button>
      </PropertyPicker>

      {hasDraft ? (
        <div className="ml-auto flex items-center gap-1">
          <Button
            className="h-9 font-regular text-content-subtle tablet:h-7 hover:text-content-strong"
            onClick={onReset}
            size="sm"
            variant="ghost"
          >
            {t('resetView')}
          </Button>
          {canEdit ? (
            <Button
              className="h-9 border-transparent bg-warn-surface text-warn tablet:h-7 hover:bg-warn-surface-strong"
              onClick={onPublish}
              size="sm"
              variant="secondary"
            >
              {t('saveViewForEveryone')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

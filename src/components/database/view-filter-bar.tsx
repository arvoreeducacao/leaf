'use client'

import { useLocale, useTranslations } from 'next-intl'

import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CancelIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  MAX_SORTS,
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

type Props = Readonly<{
  config: ViewConfig
  properties: ReadonlyArray<DatabaseProperty>
  people: ReadonlyArray<Person>
  canEdit: boolean
  hasDraft: boolean
  onConfigChange: (config: ViewConfig) => void
  onReset: () => void
  onPublish: () => void
  compact?: boolean
}>

const chipClass =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-large border border-line-strong bg-surface-card px-2 font-medium text-body-small text-content-strong transition-colors tablet:h-7 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

export function ViewFilterBar({
  config,
  properties,
  people,
  canEdit,
  hasDraft,
  onConfigChange,
  onReset,
  onPublish,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()

  if (
    config.filters.length === 0 &&
    config.sorts.length === 0 &&
    !hasDraft
  ) {
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
    const operator = t(`operator_${filter.operator}`)

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

    return text.trim().length === 0
      ? name
      : `${name}: ${operator} ${text}`
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
            <button className={chipClass} type="button">
              {sort.direction === 'asc' ? (
                <ArrowUpIcon aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <ArrowDownIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
              <span className="max-w-48 truncate">
                {nameOf(sort.propertyId)}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 items-center gap-1 p-2">
            <FieldSelect
              className="flex-1"
              label={t('sorts')}
              onChange={(value) => updateSort(index, { ...sort, propertyId: value })}
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

        return (
          <Popover key={`filter-${filter.propertyId}-${index}`}>
            <PopoverTrigger asChild>
              <button className={chipClass} type="button">
                {property ? (
                  <PropertyIcon
                    className="size-3.5 shrink-0 text-content-subtle"
                    type={property.type}
                  />
                ) : null}
                <span className="max-w-64 truncate">{describe(filter)}</span>
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

      {config.filters.length < MAX_FILTERS ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 font-regular text-content tablet:h-7"
              size="sm"
              variant="ghost"
            >
              <AddIcon aria-hidden="true" />
              {t('addFilter')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t('filters')}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => addFilter(TITLE_PROPERTY_ID)}>
              {t('titleColumn')}
            </DropdownMenuItem>
            {properties.map((property) => (
              <DropdownMenuItem
                key={property.id}
                onSelect={() => addFilter(property.id)}
              >
                <PropertyIcon type={property.type} />
                {property.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {config.sorts.length >= MAX_SORTS ? (
        <span className="text-caption text-content-subtle">
          {t('sortsFull')}
        </span>
      ) : null}

      {hasDraft ? (
        <div className="ml-auto flex items-center gap-1">
          <Button
            className="h-9 font-regular text-content tablet:h-7"
            onClick={onReset}
            size="sm"
            variant="ghost"
          >
            {t('resetView')}
          </Button>
          {canEdit ? (
            <Button className="h-9 tablet:h-7" onClick={onPublish} size="sm">
              {t('saveViewForEveryone')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

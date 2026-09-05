'use client'

import { useLocale, useTranslations } from 'next-intl'

import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  TITLE_PROPERTY_ID,
  type ViewConfig,
  type ViewFilter,
  type ViewSort,
  filterOptionIds,
  filterValueFor,
  isOptionFilterType,
  operatorNeedsValue,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { FieldSelect } from './field-select'
import { FilterValueInput } from './filter-value-input'
import {
  ChevronDownIcon,
  CloseIcon,
  EllipsisIcon,
  PlusIcon,
  SortAscIcon,
  SortDescIcon,
  TrashIcon,
} from './icons'
import { PropertyIcon } from './property-icon'
import { PropertyPicker } from './property-picker'
import { UnsavedDot } from './view-toolbar'

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
  onPublishAsNewView: () => void
  compact?: boolean
}>

const chipBase =
  'relative flex h-9 max-w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-2 text-body-small transition-colors tablet:h-6 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
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
  onPublishAsNewView,
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

  function namesOf(property: DatabaseProperty, value: ViewFilter['value']) {
    const options = optionsFor(property, people)

    return filterOptionIds(value)
      .map((id) => options.find((option) => option.id === id)?.name ?? '')
      .filter((name) => name.length > 0)
      .join(', ')
  }

  function describe(filter: ViewFilter): string {
    const property = propertyOf(filter.propertyId)
    const name = nameOf(filter.propertyId)
    const operator = capitalize(t(`operator_${filter.operator}`))

    if (!operatorNeedsValue(filter.operator)) {
      return `${name}: ${operator}`
    }

    const text = property
      ? isOptionFilterType(property.type)
        ? namesOf(property, filter.value)
        : valueToText(
            filterValueFor(property.type, filter.value),
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
        'flex flex-wrap items-center gap-1.5 py-1',
        compact ? '' : 'px-4 tablet:px-24',
      )}
    >
      {config.sorts.map((sort, index) => (
        <Popover key={`sort-${sort.propertyId}-${index}`}>
          <PopoverTrigger asChild>
            <button
              className={cn(chipBase, 'bg-brand-surface text-brand')}
              type="button"
            >
              {sort.direction === 'asc' ? (
                <SortAscIcon aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <SortDescIcon aria-hidden="true" className="size-3.5 shrink-0" />
              )}
              <span className="max-w-45 truncate">
                {nameOf(sort.propertyId)}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
              {sortsChanged ? (
                <UnsavedDot className="-top-0.5 -right-0.5" />
              ) : null}
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
              <CloseIcon aria-hidden="true" />
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
                    ? 'bg-brand-surface text-brand'
                    : 'text-content-subtle hover:bg-surface-hover',
                )}
                type="button"
              >
                <PropertyIcon
                  className="size-5 shrink-0"
                  type={property?.type ?? 'text'}
                />
                <span className="max-w-45 truncate">{describe(filter)}</span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
                {filtersChanged ? (
                  <UnsavedDot className="-top-0.5 -right-0.5" />
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className={cn(
                'overflow-hidden p-0',
                property && isOptionFilterType(property.type)
                  ? 'w-65'
                  : 'w-55',
              )}
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <div className="flex items-start px-3 pt-2 pb-0.5 text-caption text-content-tertiary">
                <PropertyPicker
                  onPick={(value) => {
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
                  placeholder={t('searchProperty')}
                  properties={properties}
                  titleLabel={t('titleColumn')}
                >
                  <button
                    className="min-w-0 cursor-pointer truncate rounded-medium px-0.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
                    type="button"
                  >
                    {nameOf(filter.propertyId)}
                  </button>
                </PropertyPicker>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mr-1 ml-0.5 flex shrink-0 cursor-pointer items-center gap-1 rounded-medium px-0.5 font-medium text-content transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
                      type="button"
                    >
                      {t(`operator_${filter.operator}`)}
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="size-3 shrink-0"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {operators.map((operator) => (
                      <DropdownMenuItem
                        key={operator}
                        onSelect={() =>
                          updateFilter(index, {
                            ...filter,
                            operator,
                            value: operatorNeedsValue(operator)
                              ? filter.value
                              : null,
                          })
                        }
                      >
                        {capitalize(t(`operator_${operator}`))}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="flex-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t('moreFilterActions')}
                      className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-medium text-content-subtle transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
                      type="button"
                    >
                      <EllipsisIcon aria-hidden="true" className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => removeFilter(index)}>
                      <TrashIcon aria-hidden="true" className="size-4" />
                      {t('removeFilter')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <FilterValueInput
                onChange={(value) => updateFilter(index, { ...filter, value })}
                operator={filter.operator}
                people={people}
                property={property}
                value={filter.value}
              />
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
          className={cn(
            chipBase,
            'rounded-xlarge pr-2.5 pl-1.5 text-content-tertiary hover:bg-surface-hover',
          )}
          type="button"
        >
          <PlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {t('addFilterShort')}
        </button>
      </PropertyPicker>

      {hasDraft ? (
        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="flex h-9 cursor-pointer items-center rounded-large px-2 text-body-small text-content-subtle transition-colors tablet:h-7 hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
            onClick={onReset}
            type="button"
          >
            {t('resetView')}
          </button>
          {canEdit ? (
            <div className="flex h-9 items-center tablet:h-7">
              <button
                className="flex h-full cursor-pointer items-center rounded-l-large bg-attention-surface px-2 text-attention text-body-small transition-colors hover:bg-attention-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                onClick={onPublish}
                type="button"
              >
                {t('saveViewForEveryone')}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t('saveViewOptions')}
                    className="flex h-full w-6 cursor-pointer items-center justify-center rounded-r-large border-attention-surface-strong border-l bg-attention-surface text-attention transition-colors hover:bg-attention-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                    type="button"
                  >
                    <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onPublishAsNewView}>
                    {t('saveAsNewView')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import {
  AddIcon,
  CancelIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilterIcon,
  LayoutGridRearrangeIcon,
  ListReorderIcon,
  MapGridIcon,
  TrashIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DatabaseProperty, DatabaseView, DatabaseViewType } from '@/db/schema'
import type { Person } from '@/lib/database/people'
import {
  MAX_FILTERS,
  MAX_SORTS,
  TITLE_PROPERTY_ID,
  type ViewConfig,
  type ViewFilter,
  type ViewSort,
  isGroupableType,
  operatorNeedsValue,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { FieldSelect } from './field-select'
import { FilterValueInput } from './filter-value-input'
import { PropertyIcon } from './property-icon'

const viewIcon: Record<DatabaseViewType, typeof MapGridIcon> = {
  table: MapGridIcon,
  board: LayoutGridRearrangeIcon,
}

type Props = Readonly<{
  views: ReadonlyArray<DatabaseView>
  activeViewId: string
  config: ViewConfig
  properties: ReadonlyArray<DatabaseProperty>
  groupPropertyId: string | null
  canEdit: boolean
  onSelectView: (id: string) => void
  onCreateView: (type: DatabaseViewType) => void
  onRenameView: (id: string, name: string) => void
  onDeleteView: (id: string) => void
  onConfigChange: (config: ViewConfig) => void
  people: ReadonlyArray<Person>
}>

export function ViewToolbar({
  views,
  activeViewId,
  config,
  properties,
  groupPropertyId,
  canEdit,
  onSelectView,
  onCreateView,
  onRenameView,
  onDeleteView,
  onConfigChange,
  people,
}: Props) {
  const t = useTranslations('database')
  const [renaming, setRenaming] = useState<string | null>(null)
  const activeView = views.find((view) => view.id === activeViewId)

  const sortTargets = [
    { value: TITLE_PROPERTY_ID, label: t('titleColumn') },
    ...properties.map((property) => ({
      value: property.id,
      label: property.name,
    })),
  ]

  const hidden = new Set(config.hiddenPropertyIds)

  function updateFilter(index: number, next: ViewFilter) {
    onConfigChange({
      ...config,
      filters: config.filters.map((filter, position) =>
        position === index ? next : filter,
      ),
    })
  }

  function propertyOf(propertyId: string) {
    return properties.find((property) => property.id === propertyId) ?? null
  }

  return (
    <div className="flex flex-col gap-2 border-line-divider border-b pb-2 tablet:flex-row tablet:items-center">
      <ul className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
        {views.map((view) => {
          const Icon = viewIcon[view.type]
          const active = view.id === activeViewId

          if (renaming === view.id) {
            return (
              <li key={view.id}>
                <input
                  aria-label={t('viewNameLabel')}
                  autoFocus
                  className="h-9 tablet:h-7 w-40 rounded-medium border border-line-contrast bg-surface-card px-2 text-body-small text-content-strong outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                  defaultValue={view.name}
                  onBlur={(event) => {
                    onRenameView(view.id, event.target.value)
                    setRenaming(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }

                    if (event.key === 'Escape') {
                      setRenaming(null)
                    }
                  }}
                />
              </li>
            )
          }

          return (
            <li className="flex items-center" key={view.id}>
              <button
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex h-9 cursor-pointer items-center gap-2 rounded-medium px-2 text-body-small transition-colors tablet:h-7 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
                  active
                    ? 'bg-surface-hover font-bold text-content-strong'
                    : 'text-content hover:bg-surface-hover hover:text-content-strong',
                )}
                onClick={() => onSelectView(view.id)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="max-w-40 truncate">{view.name}</span>
              </button>
              {canEdit && active ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <ButtonIcon
                      aria-label={t('viewMenu', { name: view.name })}
                      size="medium"
                      variant="ghost"
                    >
                      <EllipsisVerticalIcon aria-hidden="true" />
                    </ButtonIcon>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setRenaming(view.id)}>
                      {t('renameView')}
                    </DropdownMenuItem>
                    {views.length > 1 ? (
                      <DropdownMenuItem
                        onSelect={() => onDeleteView(view.id)}
                        variant="destructive"
                      >
                        <TrashIcon aria-hidden="true" />
                        {t('deleteView')}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          )
        })}

        {canEdit ? (
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ButtonIcon
                  aria-label={t('addView')}
                  size="medium"
                  variant="ghost"
                >
                  <AddIcon aria-hidden="true" />
                </ButtonIcon>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => onCreateView('table')}>
                  <MapGridIcon aria-hidden="true" />
                  {t('view_table')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateView('board')}>
                  <LayoutGridRearrangeIcon aria-hidden="true" />
                  {t('view_board')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ) : null}
      </ul>

      <div className="-mx-1 flex shrink-0 items-center gap-1 overflow-x-auto px-1">
        {activeView?.type === 'board' ? (
          <FieldSelect
            label={t('groupBy')}
            onChange={(value) =>
              onConfigChange({
                ...config,
                groupByPropertyId: value.length > 0 ? value : null,
              })
            }
            options={[
              { value: '', label: t('noGroup') },
              ...properties
                .filter((property) => isGroupableType(property.type))
                .map((property) => ({
                  value: property.id,
                  label: property.name,
                })),
            ]}
            value={groupPropertyId ?? ''}
          />
        ) : null}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-9 tablet:h-7 px-2 font-regular text-body-small"
              size="sm"
              variant="ghost"
            >
              <FilterIcon aria-hidden="true" />
              {t('filtersActive', { count: config.filters.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[22rem] p-3">
            <ul className="flex flex-col gap-2">
              {config.filters.map((filter, index) => {
                const property = propertyOf(filter.propertyId)
                const operators =
                  filter.propertyId === TITLE_PROPERTY_ID
                    ? operatorsFor('text')
                    : property
                      ? operatorsFor(property.type)
                      : operatorsFor('text')

                return (
                  <li
                    className="flex flex-wrap items-center gap-1"
                    key={`${filter.propertyId}-${index}`}
                  >
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
                      options={sortTargets}
                      value={filter.propertyId}
                    />
                    <FieldSelect
                      className="flex-1"
                      label={t('filters')}
                      onChange={(value) =>
                        updateFilter(index, {
                          ...filter,
                          operator: value as ViewFilter['operator'],
                          value: operatorNeedsValue(
                            value as ViewFilter['operator'],
                          )
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
                    <div className="flex w-full min-w-0 basis-full items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <FilterValueInput
                          onChange={(value) =>
                            updateFilter(index, { ...filter, value })
                          }
                          operator={filter.operator}
                          people={people}
                          property={property}
                          value={filter.value}
                        />
                      </div>
                      <ButtonIcon
                        aria-label={t('removeFilter')}
                        onClick={() =>
                          onConfigChange({
                            ...config,
                            filters: config.filters.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                        size="medium"
                        variant="ghost"
                      >
                        <CancelIcon aria-hidden="true" />
                      </ButtonIcon>
                    </div>
                  </li>
                )
              })}
            </ul>
            {config.filters.length < MAX_FILTERS ? (
              <Button
                className="mt-2 h-9 w-full font-regular text-body-small tablet:h-8"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    filters: [
                      ...config.filters,
                      {
                        propertyId: properties[0]?.id ?? TITLE_PROPERTY_ID,
                        operator: properties[0]
                          ? operatorsFor(properties[0].type)[0]
                          : 'contains',
                        value: null,
                      },
                    ],
                  })
                }
                size="sm"
                variant="outline"
              >
                <AddIcon aria-hidden="true" />
                {t('addFilter')}
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-9 tablet:h-7 px-2 font-regular text-body-small"
              size="sm"
              variant="ghost"
            >
              <ListReorderIcon aria-hidden="true" />
              {t('sortsActive', { count: config.sorts.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <ul className="flex flex-col gap-2">
              {config.sorts.map((sort, index) => (
                <li
                  className="flex items-center gap-1"
                  key={`${sort.propertyId}-${index}`}
                >
                  <FieldSelect
                    className="flex-1"
                    label={t('sorts')}
                    onChange={(value) =>
                      onConfigChange({
                        ...config,
                        sorts: config.sorts.map((item, position) =>
                          position === index
                            ? { ...item, propertyId: value }
                            : item,
                        ),
                      })
                    }
                    options={sortTargets}
                    value={sort.propertyId}
                  />
                  <FieldSelect
                    label={t('sorts')}
                    onChange={(value) =>
                      onConfigChange({
                        ...config,
                        sorts: config.sorts.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                direction: value as ViewSort['direction'],
                              }
                            : item,
                        ),
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
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        sorts: config.sorts.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                    size="medium"
                    variant="ghost"
                  >
                    <CancelIcon aria-hidden="true" />
                  </ButtonIcon>
                </li>
              ))}
            </ul>
            {config.sorts.length < MAX_SORTS ? (
              <Button
                className="mt-2 h-9 w-full font-regular text-body-small tablet:h-8"
                onClick={() =>
                  onConfigChange({
                    ...config,
                    sorts: [
                      ...config.sorts,
                      {
                        propertyId: TITLE_PROPERTY_ID,
                        direction: 'asc',
                      },
                    ],
                  })
                }
                size="sm"
                variant="outline"
              >
                <AddIcon aria-hidden="true" />
                {t('addSort')}
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 tablet:h-7 px-2 font-regular text-body-small"
              size="sm"
              variant="ghost"
            >
              <EyeIcon aria-hidden="true" />
              {t('properties')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('properties')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {properties.map((property) => (
              <DropdownMenuCheckboxItem
                checked={!hidden.has(property.id)}
                key={property.id}
                onCheckedChange={(checked) =>
                  onConfigChange({
                    ...config,
                    hiddenPropertyIds: checked
                      ? config.hiddenPropertyIds.filter(
                          (id) => id !== property.id,
                        )
                      : [...config.hiddenPropertyIds, property.id],
                  })
                }
                onSelect={(event) => event.preventDefault()}
              >
                <PropertyIcon type={property.type} />
                {property.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

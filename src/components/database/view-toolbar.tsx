'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import {
  AddIcon,
  CaretDownIcon,
  EyeIcon,
  FilterIcon,
  LayoutGridRearrangeIcon,
  ListCheckIcon,
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
import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'
import type { Person } from '@/lib/database/people'
import {
  MAX_FILTERS,
  MAX_SORTS,
  type DatabaseRow,
  type ViewConfig,
  isGroupableType,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { FieldSelect } from './field-select'
import { PropertyIcon } from './property-icon'
import { PropertyPicker } from './property-picker'
import { TemplateMenu } from './template-menu'
import { ViewSearch } from './view-search'

function UnsavedDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0.5 right-0.5 size-1.5 rounded-circular bg-warn"
    />
  )
}

const viewIcon: Record<DatabaseViewType, typeof MapGridIcon> = {
  table: MapGridIcon,
  board: LayoutGridRearrangeIcon,
  form: ListCheckIcon,
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
  onCreateRow: () => void
  onUseTemplate: (templateId: string) => void
  databaseId: string
  databaseTitle: string
  templates: ReadonlyArray<DatabaseRow>
  defaultTemplateId: string | null
  onSearchChange: (value: string) => void
  search: string
  filtersChanged: boolean
  sortsChanged: boolean
  people: ReadonlyArray<Person>
  compact?: boolean
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
  onCreateRow,
  onUseTemplate,
  databaseId,
  databaseTitle,
  templates,
  defaultTemplateId,
  onSearchChange,
  search,
  filtersChanged,
  sortsChanged,
  people,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const [renaming, setRenaming] = useState<string | null>(null)
  const activeView = views.find((view) => view.id === activeViewId)
  const isForm = activeView?.type === 'form'

  const hidden = new Set(config.hiddenPropertyIds)

  function propertyOf(propertyId: string) {
    return properties.find((property) => property.id === propertyId) ?? null
  }

  function addFilter(propertyId: string) {
    if (config.filters.length >= MAX_FILTERS) {
      return
    }

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

  function addSort(propertyId: string) {
    if (config.sorts.length >= MAX_SORTS) {
      return
    }

    onConfigChange({
      ...config,
      sorts: [...config.sorts, { propertyId, direction: 'asc' }],
    })
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-1 tablet:flex-row tablet:items-center',
        compact ? '' : 'px-4 tablet:px-24',
      )}
    >
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

          const tab = (
            <button
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-1.5 rounded-large px-2 font-medium text-body-small transition-colors tablet:h-7 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
                active
                  ? 'bg-surface-hover text-content-strong'
                  : 'text-content hover:bg-surface-hover hover:text-content-strong',
              )}
              onClick={active ? undefined : () => onSelectView(view.id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-w-40 truncate">{view.name}</span>
            </button>
          )

          return (
            <li className="flex items-center" key={view.id}>
              {canEdit && active ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>{tab}</DropdownMenuTrigger>
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
              ) : (
                tab
              )}
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
                <DropdownMenuItem onSelect={() => onCreateView('form')}>
                  <ListCheckIcon aria-hidden="true" />
                  {t('view_form')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ) : null}
      </ul>

      <div className="-mx-1 flex shrink-0 items-center gap-1 overflow-x-auto px-1">
        {isForm ? null : (
          <>
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

          <PropertyPicker
            disabled={config.filters.length >= MAX_FILTERS}
            onPick={addFilter}
            placeholder={t('searchProperty')}
            properties={properties}
            titleLabel={t('titleColumn')}
          >
            <ButtonIcon
              aria-label={t('filtersActive', { count: config.filters.length })}
              className="relative"
              size="medium"
              variant="ghost"
            >
              <FilterIcon
                aria-hidden="true"
                className={config.filters.length > 0 ? 'text-brand' : undefined}
              />
              {filtersChanged ? <UnsavedDot /> : null}
            </ButtonIcon>
          </PropertyPicker>

          <PropertyPicker
            disabled={config.sorts.length >= MAX_SORTS}
            onPick={addSort}
            placeholder={t('sortByProperty')}
            properties={properties}
            titleLabel={t('titleColumn')}
          >
            <ButtonIcon
              aria-label={t('sortsActive', { count: config.sorts.length })}
              className="relative"
              size="medium"
              variant="ghost"
            >
              <ListReorderIcon
                aria-hidden="true"
                className={config.sorts.length > 0 ? 'text-brand' : undefined}
              />
              {sortsChanged ? <UnsavedDot /> : null}
            </ButtonIcon>
          </PropertyPicker>

          <ViewSearch
            onChange={onSearchChange}
            placeholder={t('searchRows')}
            value={search}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ButtonIcon
                aria-label={t('properties')}
                size="medium"
                variant="ghost"
              >
                <EyeIcon aria-hidden="true" />
              </ButtonIcon>
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
          </>
        )}

        {canEdit ? (
          <div className="ml-1 flex items-center">
            {isForm ? null : (
              <Button
                className="h-9 rounded-r-none px-2 tablet:h-7"
                onClick={onCreateRow}
                size="sm"
              >
                {t('newRowShort')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ButtonIcon
                  aria-label={isForm ? t('addView') : t('templatesMenu')}
                  className={cn(
                    'h-9 tablet:h-7',
                    isForm
                      ? 'w-9 tablet:w-7'
                      : 'w-6 rounded-l-none border-l border-l-primary-600',
                  )}
                  size="medium"
                  variant="primary"
                >
                  <CaretDownIcon aria-hidden="true" />
                </ButtonIcon>
              </DropdownMenuTrigger>
              {isForm ? (
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onCreateView('table')}>
                    <MapGridIcon aria-hidden="true" />
                    {t('view_table')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onCreateView('board')}>
                    <LayoutGridRearrangeIcon aria-hidden="true" />
                    {t('view_board')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onCreateView('form')}>
                    <ListCheckIcon aria-hidden="true" />
                    {t('view_form')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              ) : (
                <TemplateMenu
                  databaseId={databaseId}
                  databaseTitle={databaseTitle}
                  defaultTemplateId={defaultTemplateId}
                  onUseTemplate={onUseTemplate}
                  templates={templates}
                />
              )}
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'
import {
  MAX_FILTERS,
  MAX_SORTS,
  type ViewConfig,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import {
  BoardLayoutIcon,
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  SettingsIcon,
  SortIcon,
  TableLayoutIcon,
} from './icons'
import { PropertyPicker } from './property-picker'
import { ViewSearch } from './view-search'
import { ViewSettings } from './view-settings'

export function UnsavedDot({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute size-[9px] rounded-circular border border-surface-app bg-attention',
        className,
      )}
    />
  )
}

const viewIcon: Record<DatabaseViewType, typeof TableLayoutIcon> = {
  table: TableLayoutIcon,
  board: BoardLayoutIcon,
}

const controlButton = 'relative size-9 rounded-large p-1.5 tablet:size-7'

type Props = Readonly<{
  views: ReadonlyArray<DatabaseView>
  activeView: DatabaseView
  config: ViewConfig
  properties: ReadonlyArray<DatabaseProperty>
  databaseId: string
  canEdit: boolean
  onSelectView: (id: string) => void
  onCreateView: (type: DatabaseViewType) => void
  onChangeLayout: (type: DatabaseViewType) => void
  onRenameView: (id: string, name: string) => void
  onDeleteView: (id: string) => void
  onConfigChange: (config: ViewConfig) => void
  onCreateRow: () => void
  onSearchChange: (value: string) => void
  search: string
  filtersChanged: boolean
  sortsChanged: boolean
  compact?: boolean
}>

export function ViewToolbar({
  views,
  activeView,
  config,
  properties,
  databaseId,
  canEdit,
  onSelectView,
  onCreateView,
  onChangeLayout,
  onRenameView,
  onDeleteView,
  onConfigChange,
  onCreateRow,
  onSearchChange,
  search,
  filtersChanged,
  sortsChanged,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const [renaming, setRenaming] = useState<string | null>(null)

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
          const active = view.id === activeView.id

          if (renaming === view.id) {
            return (
              <li key={view.id}>
                <input
                  aria-label={t('viewNameLabel')}
                  autoFocus
                  className="h-9 w-40 rounded-large border border-line-contrast bg-surface-card px-2 text-body-small text-content-strong outline-none tablet:h-8 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
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
                'flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 font-medium text-body-small transition-colors tablet:h-8 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
                active
                  ? 'bg-surface-hover text-content-strong'
                  : 'text-content hover:bg-surface-hover hover:text-content-strong',
              )}
              onClick={active ? undefined : () => onSelectView(view.id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
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
                  className={controlButton}
                  size="medium"
                  variant="ghost"
                >
                  <PlusIcon aria-hidden="true" />
                </ButtonIcon>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => onCreateView('table')}>
                  <TableLayoutIcon aria-hidden="true" className="size-5" />
                  {t('view_table')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateView('board')}>
                  <BoardLayoutIcon aria-hidden="true" className="size-5" />
                  {t('view_board')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ) : null}
      </ul>

      <div className="-mx-1 flex shrink-0 items-center overflow-x-auto px-1">
        <PropertyPicker
          disabled={config.filters.length >= MAX_FILTERS}
          onPick={addFilter}
          placeholder={t('searchProperty')}
          properties={properties}
          titleLabel={t('titleColumn')}
        >
          <ButtonIcon
            aria-label={t('filtersActive', { count: config.filters.length })}
            className={controlButton}
            size="medium"
            variant="ghost"
          >
            <FilterIcon
              aria-hidden="true"
              className={config.filters.length > 0 ? 'text-brand' : undefined}
            />
            {filtersChanged ? (
              <UnsavedDot className="top-[3px] right-[2px]" />
            ) : null}
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
            className={controlButton}
            size="medium"
            variant="ghost"
          >
            <SortIcon
              aria-hidden="true"
              className={config.sorts.length > 0 ? 'text-brand' : undefined}
            />
            {sortsChanged ? (
              <UnsavedDot className="top-[3px] right-[2px]" />
            ) : null}
          </ButtonIcon>
        </PropertyPicker>

        <ViewSearch
          onChange={onSearchChange}
          placeholder={t('searchRows')}
          value={search}
        />

        <ViewSettings
          canEdit={canEdit}
          config={config}
          databaseId={databaseId}
          onChangeLayout={onChangeLayout}
          onConfigChange={onConfigChange}
          onRenameView={onRenameView}
          properties={properties}
          view={activeView}
        >
          <ButtonIcon
            aria-label={t('viewSettings')}
            className={controlButton}
            size="medium"
            variant="ghost"
          >
            <SettingsIcon aria-hidden="true" />
          </ButtonIcon>
        </ViewSettings>

        {canEdit ? (
          <div className="ml-1.5 flex h-9 items-center tablet:h-7">
            <Button
              className="h-full rounded-r-none px-2 font-regular"
              onClick={onCreateRow}
              size="sm"
            >
              {t('newRowShort')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ButtonIcon
                  aria-label={t('newRowOptions')}
                  className="h-full !w-6 rounded-l-none border-l border-l-primary-600 p-0"
                  size="medium"
                  variant="primary"
                >
                  <ChevronDownIcon aria-hidden="true" />
                </ButtonIcon>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onCreateView('table')}>
                  <TableLayoutIcon aria-hidden="true" className="size-5" />
                  {t('view_table')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onCreateView('board')}>
                  <BoardLayoutIcon aria-hidden="true" className="size-5" />
                  {t('view_board')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  )
}

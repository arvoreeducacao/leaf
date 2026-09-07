'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'

import { ExpandDiagonalIcon } from '@/components/icons/topbar'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
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
import {
  MAX_FILTERS,
  MAX_SORTS,
  type DatabaseRow,
  type ViewConfig,
  operatorsFor,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import {
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  SettingsIcon,
  SortIcon,
} from './icons'
import { createOrder, layoutIcon } from './layouts'
import { PropertyPicker } from './property-picker'
import { TemplateMenu } from './template-menu'
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

const controlButton =
  'relative size-9 rounded-large p-1.5 tablet:size-6 tablet:p-1 [&_svg]:size-4'

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
  onSaveBaseline?: () => void
  onCreateRow: () => void
  onUseTemplate: (templateId: string) => void
  databaseTitle: string
  templates: ReadonlyArray<DatabaseRow>
  defaultTemplateId: string | null
  onSearchChange: (value: string) => void
  search: string
  filtersChanged: boolean
  sortsChanged: boolean
  formActions?: ReactNode
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
  onSaveBaseline,
  onCreateRow,
  onUseTemplate,
  databaseTitle,
  templates,
  defaultTemplateId,
  onSearchChange,
  search,
  filtersChanged,
  sortsChanged,
  formActions = null,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const [renaming, setRenaming] = useState<string | null>(null)
  const isForm = activeView.type === 'form'
  const singleView = compact && views.length === 1 && !isForm

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

  const addView = (className?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ButtonIcon
          aria-label={t('addView')}
          className={cn(controlButton, className)}
          size="medium"
          variant="ghost"
        >
          <PlusIcon aria-hidden="true" />
        </ButtonIcon>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {createOrder.map((type) => {
          const Icon = layoutIcon[type]

          return (
            <DropdownMenuItem key={type} onSelect={() => onCreateView(type)}>
              <Icon aria-hidden="true" className="size-5" />
              {t(`view_${type}`)}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const controls = (
    <div className="-mx-1 flex shrink-0 items-center gap-1 overflow-x-auto px-1">
      {isForm ? formActions : null}
      {isForm ? null : (
        <>
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

          {compact ? (
            <ButtonIcon
              aria-label={t('openFullPage')}
              asChild
              className={controlButton}
              size="medium"
              variant="ghost"
            >
              <Link href={`/doc/${databaseId}`}>
                <ExpandDiagonalIcon aria-hidden="true" />
              </Link>
            </ButtonIcon>
          ) : null}

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
        </>
      )}

      {canEdit ? (
        <div className="ml-1 flex h-9 items-center tablet:h-7">
          {isForm ? null : (
            <Button
              className="h-full rounded-r-none px-2"
              onClick={onCreateRow}
              size="sm"
            >
              {t('newRowShort')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ButtonIcon
                aria-label={isForm ? t('newRowOptions') : t('templatesMenu')}
                className={cn(
                  'h-full p-0',
                  isForm
                    ? 'w-9 rounded-large tablet:w-7'
                    : '!w-6 rounded-l-none border-l border-l-primary-600',
                )}
                size="medium"
                variant="primary"
              >
                <ChevronDownIcon aria-hidden="true" />
              </ButtonIcon>
            </DropdownMenuTrigger>
            {isForm ? (
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('addView')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {createOrder.map((type) => {
                  const Icon = layoutIcon[type]

                  return (
                    <DropdownMenuItem
                      key={type}
                      onSelect={() => onCreateView(type)}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                      {t(`view_${type}`)}
                    </DropdownMenuItem>
                  )
                })}
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
  )

  return (
    <div className={cn('flex flex-col', compact ? '' : 'px-4 tablet:px-24')}>
      {compact ? (
        <div className="group/title flex flex-col gap-2 py-1 tablet:flex-row tablet:items-center tablet:justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              className="min-w-0 truncate rounded-medium font-semibold text-content-strong text-heading-large focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              href={`/doc/${databaseId}`}
            >
              {databaseTitle}
            </Link>
            {canEdit && singleView
              ? addView(
                  'opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                )
              : null}
          </div>
          {singleView ? controls : null}
        </div>
      ) : null}

      {singleView ? null : (
        <div className="flex flex-col gap-2 py-1 tablet:flex-row tablet:items-center">
        <ul className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {views.map((view) => {
            const Icon = layoutIcon[view.type]
            const active = view.id === activeView.id

            if (renaming === view.id) {
              return (
                <li className="shrink-0" key={view.id}>
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
              <li className="flex shrink-0 items-center" key={view.id}>
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

          {canEdit ? <li className="shrink-0">{addView()}</li> : null}
        </ul>

          {controls}
        </div>
      )}
    </div>
  )
}

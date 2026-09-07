'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'
import { timelineScales } from '@/lib/database/calendar'
import {
  MAX_FILTERS,
  MAX_SORTS,
  TITLE_PROPERTY_ID,
  type ViewConfig,
  isColorableType,
  isGroupableType,
  operatorsFor,
} from '@/lib/database/views'

import {
  DateTypeIcon,
  EyeIcon,
  FilterMenuIcon,
  GroupIcon,
  LinkMenuIcon,
  PersonTypeIcon,
  SelectTypeIcon,
  SortMenuIcon,
  TimelineLayoutIcon,
  WrapIcon,
} from './icons'
import { layoutIcon, layoutOrder, scheduleLayouts } from './layouts'
import { PropertyIcon } from './property-icon'

const switchRow =
  'flex h-9 items-center gap-2 rounded-medium px-2 text-body-small text-content-strong tablet:h-8'

type Props = Readonly<{
  view: DatabaseView
  config: ViewConfig
  properties: ReadonlyArray<DatabaseProperty>
  databaseId: string
  canEdit: boolean
  onConfigChange: (config: ViewConfig) => void
  onChangeLayout: (type: DatabaseViewType) => void
  onRenameView: (id: string, name: string) => void
  children: React.ReactNode
}>

export function ViewSettings({
  view,
  config,
  properties,
  databaseId,
  canEdit,
  onConfigChange,
  onChangeLayout,
  onRenameView,
  children,
}: Props) {
  const t = useTranslations('database')

  const dateProperties = properties.filter(
    (property) => property.type === 'date',
  )
  const colorProperties = properties.filter((property) =>
    isColorableType(property.type),
  )
  const personProperties = properties.filter(
    (property) => property.type === 'person',
  )
  const hidden = new Set(config.hiddenPropertyIds)
  const visibleCount = properties.filter(
    (property) => !hidden.has(property.id),
  ).length

  function nameOf(propertyId: string) {
    return propertyId === TITLE_PROPERTY_ID
      ? t('titleColumn')
      : (properties.find((property) => property.id === propertyId)?.name ??
          t('titleColumn'))
  }

  function summaryOf(ids: ReadonlyArray<string>) {
    return ids.length === 0 ? t('none') : ids.map(nameOf).join(', ')
  }

  function addFilter(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId)
    const allowed = property ? operatorsFor(property.type) : operatorsFor('text')

    onConfigChange({
      ...config,
      filters: [
        ...config.filters,
        { propertyId, operator: allowed[0], value: null },
      ],
    })
  }

  function toggleSort(propertyId: string) {
    const present = config.sorts.some((sort) => sort.propertyId === propertyId)

    onConfigChange({
      ...config,
      sorts: present
        ? config.sorts.filter((sort) => sort.propertyId !== propertyId)
        : [...config.sorts, { propertyId, direction: 'asc' }],
    })
  }

  function toggleFilter(propertyId: string) {
    const present = config.filters.some(
      (filter) => filter.propertyId === propertyId,
    )

    if (present) {
      onConfigChange({
        ...config,
        filters: config.filters.filter(
          (filter) => filter.propertyId !== propertyId,
        ),
      })

      return
    }

    addFilter(propertyId)
  }

  async function copyViewLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/doc/${databaseId}?v=${view.id}`,
      )
      toast.success(t('viewLinkCopied'))
    } catch {
      toast.error(t('viewLinkCopyFailed'))
    }
  }

  const LayoutIcon = layoutIcon[view.type]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <LayoutIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-content-subtle"
          />
          <Input
            aria-label={t('viewNameLabel')}
            className="h-9 flex-1 text-body-small tablet:h-8"
            defaultValue={view.name}
            disabled={!canEdit}
            key={view.id}
            onBlur={(event) => onRenameView(view.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!canEdit}>
            <LayoutIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{t('layout')}</span>
            <span className="text-content-subtle">{t(`view_${view.type}`)}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            {layoutOrder.map((type) => {
              const Icon = layoutIcon[type]

              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => onChangeLayout(type)}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {t(`view_${type}`)}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <div className={switchRow}>
              <span className="flex-1">{t('showVerticalLines')}</span>
              <Switch
                aria-label={t('showVerticalLines')}
                checked={config.showVerticalLines}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, showVerticalLines: checked })
                }
              />
            </div>
            <div className={switchRow}>
              <span className="flex-1">{t('showPageIcon')}</span>
              <Switch
                aria-label={t('showPageIcon')}
                checked={config.showPageIcon}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, showPageIcon: checked })
                }
              />
            </div>
            <div className={switchRow}>
              <WrapIcon
                aria-hidden="true"
                className="size-5 text-content-subtle"
              />
              <span className="flex-1">{t('wrapCells')}</span>
              <Switch
                aria-label={t('wrapCells')}
                checked={config.wrapCells}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, wrapCells: checked })
                }
              />
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <EyeIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{t('propertyVisibility')}</span>
            <span className="text-content-subtle">{visibleCount}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
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
                <span className="min-w-0 truncate">{property.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FilterMenuIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{t('addFilterShort')}</span>
            <span className="max-w-32 truncate text-content-subtle">
              {summaryOf(config.filters.map((filter) => filter.propertyId))}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
            {properties.map((property) => (
              <DropdownMenuCheckboxItem
                checked={config.filters.some(
                  (filter) => filter.propertyId === property.id,
                )}
                disabled={
                  config.filters.length >= MAX_FILTERS &&
                  !config.filters.some(
                    (filter) => filter.propertyId === property.id,
                  )
                }
                key={property.id}
                onCheckedChange={() => toggleFilter(property.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <PropertyIcon type={property.type} />
                <span className="min-w-0 truncate">{property.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SortMenuIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{t('sortAction')}</span>
            <span className="max-w-32 truncate text-content-subtle">
              {summaryOf(config.sorts.map((sort) => sort.propertyId))}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
            {properties.map((property) => (
              <DropdownMenuCheckboxItem
                checked={config.sorts.some(
                  (sort) => sort.propertyId === property.id,
                )}
                disabled={
                  config.sorts.length >= MAX_SORTS &&
                  !config.sorts.some((sort) => sort.propertyId === property.id)
                }
                key={property.id}
                onCheckedChange={() => toggleSort(property.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <PropertyIcon type={property.type} />
                <span className="min-w-0 truncate">{property.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {scheduleLayouts.includes(view.type) ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <DateTypeIcon aria-hidden="true" className="size-5" />
              <span className="flex-1">{t('dateProperty')}</span>
              <span className="max-w-32 truncate text-content-subtle">
                {config.datePropertyId
                  ? nameOf(config.datePropertyId)
                  : (dateProperties[0]?.name ?? t('none'))}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {dateProperties.map((property) => (
                <DropdownMenuItem
                  key={property.id}
                  onSelect={() =>
                    onConfigChange({ ...config, datePropertyId: property.id })
                  }
                >
                  <PropertyIcon type={property.type} />
                  <span className="min-w-0 truncate">{property.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {view.type === 'timeline' ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <DateTypeIcon aria-hidden="true" className="size-5" />
              <span className="flex-1">{t('endDateProperty')}</span>
              <span className="max-w-32 truncate text-content-subtle">
                {config.endDatePropertyId
                  ? nameOf(config.endDatePropertyId)
                  : t('none')}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuItem
                onSelect={() =>
                  onConfigChange({ ...config, endDatePropertyId: null })
                }
              >
                {t('none')}
              </DropdownMenuItem>
              {dateProperties.map((property) => (
                <DropdownMenuItem
                  key={property.id}
                  onSelect={() =>
                    onConfigChange({ ...config, endDatePropertyId: property.id })
                  }
                >
                  <PropertyIcon type={property.type} />
                  <span className="min-w-0 truncate">{property.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        {view.type === 'timeline' ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TimelineLayoutIcon aria-hidden="true" className="size-5" />
                <span className="flex-1">{t('timelineScale')}</span>
                <span className="text-content-subtle">
                  {t(`scale_${config.timelineScale}`)}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                {timelineScales.map((scale) => (
                  <DropdownMenuCheckboxItem
                    checked={config.timelineScale === scale}
                    key={scale}
                    onCheckedChange={() =>
                      onConfigChange({ ...config, timelineScale: scale })
                    }
                  >
                    {t(`scale_${scale}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SelectTypeIcon aria-hidden="true" className="size-5" />
                <span className="flex-1">{t('colorBy')}</span>
                <span className="max-w-32 truncate text-content-subtle">
                  {config.colorPropertyId
                    ? nameOf(config.colorPropertyId)
                    : t('noColor')}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuItem
                  onSelect={() =>
                    onConfigChange({ ...config, colorPropertyId: null })
                  }
                >
                  {t('noColor')}
                </DropdownMenuItem>
                {colorProperties.map((property) => (
                  <DropdownMenuItem
                    key={property.id}
                    onSelect={() =>
                      onConfigChange({ ...config, colorPropertyId: property.id })
                    }
                  >
                    <PropertyIcon type={property.type} />
                    <span className="min-w-0 truncate">{property.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PersonTypeIcon aria-hidden="true" className="size-5" />
                <span className="flex-1">{t('peopleOnBars')}</span>
                <span className="max-w-32 truncate text-content-subtle">
                  {config.peoplePropertyId
                    ? nameOf(config.peoplePropertyId)
                    : t('none')}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuItem
                  onSelect={() =>
                    onConfigChange({ ...config, peoplePropertyId: null })
                  }
                >
                  {t('none')}
                </DropdownMenuItem>
                {personProperties.map((property) => (
                  <DropdownMenuItem
                    key={property.id}
                    onSelect={() =>
                      onConfigChange({
                        ...config,
                        peoplePropertyId: property.id,
                      })
                    }
                  >
                    <PropertyIcon type={property.type} />
                    <span className="min-w-0 truncate">{property.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}

        {view.type === 'board' || view.type === 'timeline' ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <GroupIcon aria-hidden="true" className="size-5" />
              <span className="flex-1">{t('groupBy')}</span>
              <span className="max-w-32 truncate text-content-subtle">
                {config.groupByPropertyId
                  ? nameOf(config.groupByPropertyId)
                  : t('noGroup')}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuItem
                onSelect={() =>
                  onConfigChange({ ...config, groupByPropertyId: null })
                }
              >
                {t('noGroup')}
              </DropdownMenuItem>
              {properties
                .filter((property) => isGroupableType(property.type))
                .map((property) => (
                  <DropdownMenuItem
                    key={property.id}
                    onSelect={() =>
                      onConfigChange({
                        ...config,
                        groupByPropertyId: property.id,
                      })
                    }
                  >
                    <PropertyIcon type={property.type} />
                    <span className="min-w-0 truncate">{property.name}</span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void copyViewLink()}>
          <LinkMenuIcon aria-hidden="true" className="size-5" />
          {t('copyViewLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

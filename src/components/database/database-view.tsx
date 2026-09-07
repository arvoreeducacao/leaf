'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useSearchParams } from 'next/navigation'

import type {
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'
import {
  addDatabaseProperty,
  addSelectOption,
  changeDatabasePropertyType,
  clearDatabaseViewDraft,
  createDatabaseRow,
  createDatabaseView,
  deleteDatabaseProperty,
  deleteDatabaseRow,
  deleteDatabaseView,
  deleteSelectOption,
  publishDatabaseViewDraft,
  renameDatabaseProperty,
  renameDatabaseRow,
  saveDatabaseViewDraft,
  setDatabaseRowValue,
  setDatabaseUniqueIdPrefix,
  updateDatabaseView,
} from '@/lib/database-actions'
import { type FormConfig, emptyFormConfig } from '@/lib/database/forms'
import { personOptions } from '@/lib/database/people'
import {
  type PropertyRefresh,
  parseUniqueIdConfig,
  serializeUniqueIdConfig,
} from '@/lib/database/unique-id'
import { parseOptions, serializeOptions } from '@/lib/database/values'
import { calendarPropertiesOf } from '@/lib/database/calendar'
import {
  DEFAULT_VIEW_ID,
  type ViewConfig,
  applyFilters,
  applySearch,
  applySorts,
  boardPropertyOf,
  colorPropertyOf,
  groupRows,
  parseViewConfig,
  peoplePropertyOf,
  serializeViewConfig,
  timelineGroupPropertyOf,
  visibleProperties,
} from '@/lib/database/views'
import type { DatabaseSnapshot } from '@/lib/databases'
import type { FormSlackLink } from '@/lib/form-webhooks'
import { cn } from '@/shared/utils'

import { BoardView } from './board-view'
import { CalendarView } from './calendar-view'
import { FormEditor } from './form-editor'
import { FormToolbar } from './form-toolbar'
import { GalleryView } from './gallery-view'
import { ListView } from './list-view'
import { TableView } from './table-view'
import { TimelineView } from './timeline-view'
import type { DatabaseHandlers } from './types'
import { ViewFilterBar } from './view-filter-bar'
import { ViewToolbar } from './view-toolbar'

const configSaveDelay = 500

const optionKinds: ReadonlyArray<DatabasePropertyType> = [
  'select',
  'multiSelect',
  'status',
]

function keepsSelectOptions(
  from: DatabasePropertyType,
  to: DatabasePropertyType,
): boolean {
  return optionKinds.includes(from) && optionKinds.includes(to)
}

type Props = Readonly<{
  snapshot: DatabaseSnapshot
  canEdit: boolean
  compact?: boolean
}>

export function DatabaseView({ snapshot, canEdit, compact = false }: Props) {
  const t = useTranslations('database')
  const [properties, setProperties] = useState(snapshot.properties)
  const [views, setViews] = useState(snapshot.views)
  const [rows, setRows] = useState(snapshot.rows)
  const params = useSearchParams()
  const requestedViewId = params.get('v')
  const [notifyingViewIds, setNotifyingViewIds] = useState(
    () => new Set(snapshot.notifyingViewIds),
  )
  const [slackLinks, setSlackLinks] = useState<Record<string, FormSlackLink>>(
    () =>
      Object.fromEntries(snapshot.slackLinks.map((link) => [link.viewId, link])),
  )
  const [previewing, setPreviewing] = useState(false)
  const [activeViewId, setActiveViewId] = useState(
    snapshot.views.find((view) => view.id === requestedViewId)?.id ??
      snapshot.views[0]?.id ??
      '',
  )
  const [saved, setSaved] = useState<Record<string, ViewConfig>>(() =>
    Object.fromEntries(
      snapshot.views.map((view) => [view.id, parseViewConfig(view.config)]),
    ),
  )
  const [drafts, setDrafts] = useState<Record<string, ViewConfig>>(() =>
    Object.fromEntries(
      Object.entries(snapshot.drafts).map(([viewId, raw]) => [
        viewId,
        parseViewConfig(raw),
      ]),
    ),
  )
  const [search, setSearch] = useState('')

  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const timers = saveTimers.current

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }

      timers.clear()
    }
  }, [])

  function fail() {
    toast.error(t('saveFailed'))
  }

  async function guard(run: () => Promise<{ ok: boolean; error?: string }>) {
    try {
      const result = await run()

      if (!result.ok) {
        toast.error(result.error ?? t('saveFailed'))
      }
    } catch {
      fail()
    }
  }

  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0] ?? null

  const savedConfig = activeView
    ? (saved[activeView.id] ?? parseViewConfig(activeView.config))
    : parseViewConfig(null)

  const draftConfig = activeView ? drafts[activeView.id] : undefined

  const config = draftConfig ?? savedConfig

  const hasDraft =
    draftConfig !== undefined &&
    serializeViewConfig(draftConfig) !== serializeViewConfig(savedConfig)

  const filtersChanged =
    hasDraft &&
    JSON.stringify(config.filters) !== JSON.stringify(savedConfig.filters)

  const sortsChanged =
    hasDraft && JSON.stringify(config.sorts) !== JSON.stringify(savedConfig.sorts)

  function persistDraft(viewId: string, next: ViewConfig | null) {
    if (!snapshot.viewerId || viewId === DEFAULT_VIEW_ID) {
      return
    }

    const timers = saveTimers.current
    const running = timers.get(viewId)

    if (running) {
      clearTimeout(running)
    }

    timers.set(
      viewId,
      setTimeout(() => {
        timers.delete(viewId)
        void guard(() =>
          next === null
            ? clearDatabaseViewDraft(viewId)
            : saveDatabaseViewDraft(viewId, next),
        )
      }, configSaveDelay),
    )
  }

  function applyRefresh(propertyId: string, refresh: PropertyRefresh | null) {
    if (!refresh) {
      return
    }

    setProperties((current) =>
      current.map((item) =>
        item.id === propertyId ? { ...item, options: refresh.options } : item,
      ),
    )

    const byRow = new Map(
      refresh.values.map((item) => [item.rowId, item.value]),
    )

    setRows((current) =>
      current.map((row) =>
        byRow.has(row.id)
          ? { ...row, values: { ...row.values, [propertyId]: byRow.get(row.id) ?? null } }
          : row,
      ),
    )
  }

  function changeConfig(next: ViewConfig) {
    if (!activeView) {
      return
    }

    const matchesSaved =
      serializeViewConfig(next) === serializeViewConfig(savedConfig)

    setDrafts((current) => {
      if (matchesSaved) {
        const { [activeView.id]: _removed, ...rest } = current

        return rest
      }

      return { ...current, [activeView.id]: next }
    })

    persistDraft(activeView.id, matchesSaved ? null : next)
  }

  function resetView() {
    if (!activeView) {
      return
    }

    const viewId = activeView.id

    setDrafts((current) => {
      const { [viewId]: _removed, ...rest } = current

      return rest
    })

    persistDraft(viewId, null)
  }

  function changeLayout(type: DatabaseViewType) {
    if (!activeView || activeView.type === type) {
      return
    }

    const viewId = activeView.id

    setViews((current) =>
      current.map((view) => (view.id === viewId ? { ...view, type } : view)),
    )

    if (viewId !== DEFAULT_VIEW_ID) {
      void guard(() => updateDatabaseView(viewId, { type }))
    }
  }

  function publishAsNewView() {
    if (!activeView || draftConfig === undefined) {
      return
    }

    const source = activeView
    const published = draftConfig

    void (async () => {
      try {
        const result = await createDatabaseView(
          snapshot.id,
          source.type,
          t('copyOfView', { name: source.name }),
        )

        if (!result.ok) {
          toast.error(result.error)

          return
        }

        await updateDatabaseView(result.id, { config: published })

        const view: DatabaseView = {
          id: result.id,
          databaseId: snapshot.id,
          name: t('copyOfView', { name: source.name }),
          type: source.type,
          config: serializeViewConfig(published),
          publicToken: null,
          position: views.length,
          createdAt: new Date(),
        }

        setViews((current) => [...current, view])
        setSaved((current) => ({ ...current, [view.id]: published }))
        setActiveViewId(view.id)
        resetView()
      } catch {
        fail()
      }
    })()
  }

  function publishView() {
    if (!activeView || !hasDraft || draftConfig === undefined) {
      return
    }

    const viewId = activeView.id
    const published = draftConfig

    setSaved((current) => ({ ...current, [viewId]: published }))
    setDrafts((current) => {
      const { [viewId]: _removed, ...rest } = current

      return rest
    })

    const timers = saveTimers.current
    const running = timers.get(viewId)

    if (running) {
      clearTimeout(running)
      timers.delete(viewId)
    }

    if (viewId !== DEFAULT_VIEW_ID) {
      void guard(() => publishDatabaseViewDraft(viewId, published))
    }
  }

  const handlers: DatabaseHandlers = {
    commitValue(rowId, propertyId, value) {
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? { ...row, values: { ...row.values, [propertyId]: value } }
            : row,
        ),
      )

      void guard(() => setDatabaseRowValue(rowId, propertyId, value))
    },
    renameRow(rowId, title) {
      const trimmed = title.trim()
      const current = rows.find((row) => row.id === rowId)

      if (!current || current.title === trimmed) {
        return
      }

      setRows((list) =>
        list.map((row) => (row.id === rowId ? { ...row, title: trimmed } : row)),
      )

      void guard(() => renameDatabaseRow(rowId, trimmed))
    },
    createRow(seed = {}, templateId = null) {
      void (async () => {
        try {
          const result = await createDatabaseRow(
            snapshot.id,
            seed,
            '',
            templateId,
          )

          if (!result.ok) {
            toast.error(result.error)

            return
          }

          setRows((current) => [...current, result.row])
        } catch {
          fail()
        }
      })()
    },
    deleteRow(rowId) {
      setRows((current) => current.filter((row) => row.id !== rowId))
      void guard(() => deleteDatabaseRow(rowId))
    },
    async createOption(propertyId, name) {
      const property = properties.find((item) => item.id === propertyId)

      if (!property) {
        return null
      }

      try {
        const result = await addSelectOption(propertyId, name)

        if (!result.ok) {
          toast.error(result.error)

          return null
        }

        setProperties((current) =>
          current.map((item) => {
            if (item.id !== propertyId) {
              return item
            }

            const options = parseOptions(item.options)

            if (options.some((option) => option.id === result.option.id)) {
              return item
            }

            return {
              ...item,
              options: serializeOptions([...options, result.option]),
            }
          }),
        )

        return result.option
      } catch {
        fail()

        return null
      }
    },
    deleteOption(propertyId, optionId) {
      setProperties((current) =>
        current.map((item) =>
          item.id === propertyId
            ? {
                ...item,
                options: serializeOptions(
                  parseOptions(item.options).filter(
                    (option) => option.id !== optionId,
                  ),
                ),
              }
            : item,
        ),
      )

      void guard(() => deleteSelectOption(propertyId, optionId))
    },
    async addProperty(type) {
      const name = t(`type_${type}`)

      try {
        const result = await addDatabaseProperty(snapshot.id, type, name)

        if (!result.ok) {
          toast.error(result.error)

          return null
        }

        setProperties((current) => [
          ...current,
          {
            id: result.id,
            databaseId: snapshot.id,
            name,
            type,
            options: result.refresh?.options ?? null,
            position: current.length,
            createdAt: new Date(),
          } satisfies DatabaseProperty,
        ])

        applyRefresh(result.id, result.refresh)

        return result.id
      } catch {
        fail()

        return null
      }
    },
    renameProperty(propertyId, name) {
      const trimmed = name.trim()

      if (trimmed.length === 0) {
        return
      }

      setProperties((current) =>
        current.map((item) =>
          item.id === propertyId ? { ...item, name: trimmed } : item,
        ),
      )

      void guard(() => renameDatabaseProperty(propertyId, trimmed))
    },
    changePropertyType(propertyId, type) {
      setProperties((current) =>
        current.map((item) =>
          item.id === propertyId
            ? {
                ...item,
                type,
                options: keepsSelectOptions(item.type, type)
                  ? item.options
                  : null,
              }
            : item,
        ),
      )

      void (async () => {
        try {
          const result = await changeDatabasePropertyType(propertyId, type)

          if (!result.ok) {
            toast.error(result.error)

            return
          }

          applyRefresh(propertyId, result.refresh)
        } catch {
          fail()
        }
      })()
    },
    changeUniqueIdPrefix(propertyId, prefix) {
      setProperties((current) =>
        current.map((item) =>
          item.id === propertyId
            ? {
                ...item,
                options: serializeUniqueIdConfig({
                  prefix,
                  next: parseUniqueIdConfig(item.options).next,
                }),
              }
            : item,
        ),
      )

      void guard(() => setDatabaseUniqueIdPrefix(propertyId, prefix))
    },
    hideProperty(propertyId) {
      changeConfig({
        ...config,
        hiddenPropertyIds: [...config.hiddenPropertyIds, propertyId],
      })
    },
    deleteProperty(propertyId) {
      setProperties((current) =>
        current.filter((item) => item.id !== propertyId),
      )

      void guard(() => deleteDatabaseProperty(propertyId))
    },
  }

  function createView(type: DatabaseViewType) {
    const name = t(`view_${type}`)

    void (async () => {
      try {
        const result = await createDatabaseView(snapshot.id, type, name)

        if (!result.ok) {
          toast.error(result.error)

          return
        }

        const view: DatabaseView = {
          id: result.id,
          databaseId: snapshot.id,
          name,
          type,
          config: result.config,
          publicToken: null,
          position: views.length,
          createdAt: new Date(),
        }

        setViews((current) => [...current, view])
        setSaved((current) => ({
          ...current,
          [view.id]: parseViewConfig(result.config),
        }))
        setActiveViewId(view.id)
      } catch {
        fail()
      }
    })()
  }

  function renameView(viewId: string, name: string) {
    const trimmed = name.trim()

    if (trimmed.length === 0) {
      return
    }

    setViews((current) =>
      current.map((view) =>
        view.id === viewId ? { ...view, name: trimmed } : view,
      ),
    )

    if (viewId !== DEFAULT_VIEW_ID) {
      void guard(() => updateDatabaseView(viewId, { name: trimmed }))
    }
  }

  function deleteView(viewId: string) {
    if (views.length <= 1) {
      toast.error(t('lastViewKept'))

      return
    }

    const remaining = views.filter((view) => view.id !== viewId)

    setViews(remaining)
    setDrafts((current) => {
      const { [viewId]: _removed, ...rest } = current

      return rest
    })

    if (activeViewId === viewId) {
      setActiveViewId(remaining[0]?.id ?? '')
    }

    void guard(() => deleteDatabaseView(viewId))
  }

  const shown = useMemo(
    () => visibleProperties(properties, config),
    [config, properties],
  )

  const people = useMemo(
    () => personOptions(snapshot.people),
    [snapshot.people],
  )

  const filtered = useMemo(
    () =>
      applySorts(
        applySearch(
          applyFilters(
            rows,
            config.filters,
            properties,
            snapshot.viewerId,
            people,
          ),
          search,
          properties,
          people,
        ),
        config.sorts,
        properties,
        people,
      ),
    [
      config.filters,
      config.sorts,
      people,
      properties,
      rows,
      search,
      snapshot.viewerId,
    ],
  )

  const groupProperty = useMemo(() => {
    if (activeView?.type === 'board') {
      return boardPropertyOf(properties, config)
    }

    if (activeView?.type === 'timeline') {
      return timelineGroupPropertyOf(properties, config)
    }

    return null
  }, [activeView, config, properties])

  const resolvedGroupProperty = groupProperty
    ? (properties.find((item) => item.id === groupProperty.id) ?? null)
    : null

  const schedule = useMemo(
    () => calendarPropertiesOf(properties, config),
    [config, properties],
  )

  const groups = useMemo(
    () =>
      groupRows(
        filtered,
        resolvedGroupProperty,
        resolvedGroupProperty?.type === 'person'
          ? t('noPerson')
          : t('noValue'),
        people,
      ),
    [filtered, people, resolvedGroupProperty, t],
  )

  if (!activeView) {
    return null
  }

  const gutter = compact ? '' : 'px-4 tablet:px-24'

  function changeForm(form: FormConfig) {
    if (!activeView) {
      return
    }

    const viewId = activeView.id
    const next = { ...config, form }

    setSaved((current) => ({ ...current, [viewId]: next }))
    setDrafts((current) => {
      const { [viewId]: _removed, ...rest } = current

      return rest
    })

    const timers = saveTimers.current
    const running = timers.get(viewId)

    if (running) {
      clearTimeout(running)
    }

    timers.set(
      viewId,
      setTimeout(() => {
        timers.delete(viewId)
        void guard(() => publishDatabaseViewDraft(viewId, next))
      }, configSaveDelay),
    )
  }

  function changeNotifying(viewId: string, notifying: boolean) {
    setNotifyingViewIds((current) => {
      const next = new Set(current)

      if (notifying) {
        next.add(viewId)
      } else {
        next.delete(viewId)
      }

      return next
    })
  }

  function changeSlackLink(viewId: string, link: FormSlackLink | null) {
    setSlackLinks((current) => {
      const next = { ...current }

      if (link) {
        next[viewId] = link
      } else {
        delete next[viewId]
      }

      return next
    })
  }

  function changeToken(viewId: string, token: string | null) {
    setViews((current) =>
      current.map((view) =>
        view.id === viewId ? { ...view, publicToken: token } : view,
      ),
    )
  }

  return (
    <section
      className={cn(
        'flex min-w-0 flex-col',
        compact ? 'gap-2' : undefined,
      )}
    >
      <ViewToolbar
        activeView={activeView}
        canEdit={canEdit}
        compact={compact}
        config={config}
        databaseId={snapshot.id}
        formActions={
          activeView.type === 'form' ? (
            <FormToolbar
              canEdit={canEdit}
              config={config.form ?? emptyFormConfig}
              notifying={notifyingViewIds.has(activeView.id)}
              onChange={changeForm}
              onNotifyingChange={(notifying) =>
                changeNotifying(activeView.id, notifying)
              }
              onPreviewingChange={setPreviewing}
              onSlackLinkChange={(link) => changeSlackLink(activeView.id, link)}
              onTokenChange={(token) => changeToken(activeView.id, token)}
              previewing={previewing}
              properties={properties}
              slackBotReady={snapshot.slackBotReady}
              slackLink={slackLinks[activeView.id] ?? null}
              view={activeView}
            />
          ) : null
        }
        filtersChanged={filtersChanged}
        onChangeLayout={changeLayout}
        onConfigChange={changeConfig}
        databaseTitle={snapshot.title}
        defaultTemplateId={snapshot.defaultTemplateId}
        onCreateRow={() =>
          handlers.createRow({}, snapshot.defaultTemplateId)
        }
        onUseTemplate={(templateId) => handlers.createRow({}, templateId)}
        templates={snapshot.templates}
        onCreateView={createView}
        onDeleteView={deleteView}
        onRenameView={renameView}
        onSearchChange={setSearch}
        onSelectView={setActiveViewId}
        properties={properties}
        search={search}
        sortsChanged={sortsChanged}
        views={views}
      />

      {activeView.type === 'form' ? null : (
        <ViewFilterBar
          canEdit={canEdit}
          compact={compact}
          config={config}
          filtersChanged={filtersChanged}
          hasDraft={hasDraft}
          onConfigChange={changeConfig}
          onPublish={publishView}
          onPublishAsNewView={publishAsNewView}
          onReset={resetView}
          people={snapshot.people}
          properties={properties}
          sortsChanged={sortsChanged}
        />
      )}

      {activeView.type !== 'form' && rows.length === 0 ? (
        <p className={cn('py-3 text-body-small text-content', gutter)}>
          {t('noRows')}{' '}
          <span className="text-content-subtle">{t('noRowsHint')}</span>
        </p>
      ) : null}

      {activeView.type === 'form' ? (
        <FormEditor
          canEdit={canEdit}
          compact={compact}
          config={config.form ?? emptyFormConfig}
          databaseIcon={snapshot.icon}
          databaseTitle={snapshot.title}
          onAddOption={async (propertyId, name) => {
            await handlers.createOption(propertyId, name)
          }}
          onChange={changeForm}
          hasOrganization={snapshot.people.length > 0}
          onAddProperty={handlers.addProperty}
          onChangePropertyType={handlers.changePropertyType}
          onRemoveOption={handlers.deleteOption}
          onTokenChange={(token) => changeToken(activeView.id, token)}
          previewing={previewing}
          properties={properties}
          view={activeView}
        />
      ) : null}

      {activeView.type === 'board' ? (
        <BoardView
          canEdit={canEdit}
          groupProperty={resolvedGroupProperty}
          groups={groups}
          handlers={handlers}
          people={snapshot.people}
          properties={shown}
        />
      ) : null}

      {activeView.type === 'gallery' ? (
        <GalleryView
          canEdit={canEdit}
          compact={compact}
          handlers={handlers}
          people={snapshot.people}
          properties={shown}
          rows={filtered}
          showPageIcon={config.showPageIcon}
        />
      ) : null}

      {activeView.type === 'list' ? (
        <ListView
          canEdit={canEdit}
          compact={compact}
          handlers={handlers}
          people={snapshot.people}
          properties={shown}
          rows={filtered}
          showPageIcon={config.showPageIcon}
        />
      ) : null}

      {activeView.type === 'calendar' ? (
        <CalendarView
          canEdit={canEdit}
          compact={compact}
          dateProperty={schedule.start}
          handlers={handlers}
          rows={filtered}
          showPageIcon={config.showPageIcon}
        />
      ) : null}

      {activeView.type === 'timeline' ? (
        <TimelineView
          canEdit={canEdit}
          colorProperty={colorPropertyOf(properties, config)}
          compact={compact}
          endProperty={schedule.end}
          groupProperty={resolvedGroupProperty}
          groups={resolvedGroupProperty ? groups : null}
          handlers={handlers}
          people={snapshot.people}
          peopleProperty={peoplePropertyOf(properties, config)}
          rows={filtered}
          scale={config.timelineScale}
          showPageIcon={config.showPageIcon}
          startProperty={schedule.start}
        />
      ) : null}

      {activeView.type === 'table' ? (
        <TableView
          canEdit={canEdit}
          compact={compact}
          handlers={handlers}
          people={snapshot.people}
          properties={shown}
          rows={filtered}
          showPageIcon={config.showPageIcon}
          verticalLines={config.showVerticalLines}
          wrap={config.wrapCells}
        />
      ) : null}

      {activeView.type !== 'form' &&
      filtered.length === 0 &&
      rows.length > 0 ? (
        <p className={cn('py-3 text-body-small text-content', gutter)}>
          {search.trim().length > 0 ? t('noSearchResults') : t('noResults')}
        </p>
      ) : null}

      {activeView.type === 'form' ? null : (
        <p className={cn('pt-2 text-caption text-content-subtle', gutter)}>
          {t('rowCount', { count: filtered.length })}
        </p>
      )}
    </section>
  )
}
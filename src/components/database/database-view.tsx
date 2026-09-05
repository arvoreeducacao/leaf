'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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
  publishDatabaseViewDraft,
  renameDatabaseProperty,
  renameDatabaseRow,
  saveDatabaseViewDraft,
  setDatabaseRowValue,
  setDatabaseUniqueIdPrefix,
  updateDatabaseView,
} from '@/lib/database-actions'
import { personOptions } from '@/lib/database/people'
import {
  type PropertyRefresh,
  parseUniqueIdConfig,
  serializeUniqueIdConfig,
} from '@/lib/database/unique-id'
import { parseOptions, serializeOptions } from '@/lib/database/values'
import {
  type ViewConfig,
  applyFilters,
  applySearch,
  applySorts,
  boardPropertyOf,
  groupRows,
  parseViewConfig,
  serializeViewConfig,
  visibleProperties,
} from '@/lib/database/views'
import type { DatabaseSnapshot } from '@/lib/databases'
import { cn } from '@/shared/utils'

import { BoardView } from './board-view'
import { TableView } from './table-view'
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
  const [activeViewId, setActiveViewId] = useState(snapshot.views[0]?.id ?? '')
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

  function persistDraft(viewId: string, next: ViewConfig | null) {
    if (!snapshot.viewerId) {
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

    void guard(() => publishDatabaseViewDraft(viewId, published))
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
    createRow(seed = {}) {
      void (async () => {
        try {
          const result = await createDatabaseRow(snapshot.id, seed)

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
    addProperty(type) {
      const name = t(`type_${type}`)

      void (async () => {
        try {
          const result = await addDatabaseProperty(snapshot.id, type, name)

          if (!result.ok) {
            toast.error(result.error)

            return
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
        } catch {
          fail()
        }
      })()
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
          config: null,
          position: views.length,
          createdAt: new Date(),
        }

        setViews((current) => [...current, view])
        setSaved((current) => ({
          ...current,
          [view.id]: parseViewConfig(null),
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

    void guard(() => updateDatabaseView(viewId, { name: trimmed }))
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

  const groupProperty = useMemo(
    () =>
      activeView?.type === 'board' ? boardPropertyOf(properties, config) : null,
    [activeView, config, properties],
  )

  const resolvedGroupProperty = groupProperty
    ? (properties.find((item) => item.id === groupProperty.id) ?? null)
    : null

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

  return (
    <section
      className={cn(
        'flex min-w-0 flex-col',
        compact ? 'gap-2' : undefined,
      )}
    >
      <ViewToolbar
        activeViewId={activeView.id}
        canEdit={canEdit}
        compact={compact}
        config={config}
        onConfigChange={changeConfig}
        onCreateRow={() => handlers.createRow()}
        onCreateView={createView}
        onDeleteView={deleteView}
        onRenameView={renameView}
        onSearchChange={setSearch}
        onSelectView={setActiveViewId}
        groupPropertyId={
          activeView.type === 'board' ? (resolvedGroupProperty?.id ?? null) : null
        }
        people={snapshot.people}
        properties={properties}
        search={search}
        views={views}
      />

      <ViewFilterBar
        canEdit={canEdit}
        compact={compact}
        config={config}
        hasDraft={hasDraft}
        onConfigChange={changeConfig}
        onPublish={publishView}
        onReset={resetView}
        people={snapshot.people}
        properties={properties}
      />

      {rows.length === 0 ? (
        <p className={cn('py-3 text-body-small text-content', gutter)}>
          {t('noRows')}{' '}
          <span className="text-content-subtle">{t('noRowsHint')}</span>
        </p>
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
      ) : (
        <TableView
          canEdit={canEdit}
          compact={compact}
          handlers={handlers}
          people={snapshot.people}
          properties={shown}
          rows={filtered}
        />
      )}

      {filtered.length === 0 && rows.length > 0 ? (
        <p className={cn('py-3 text-body-small text-content', gutter)}>
          {search.trim().length > 0 ? t('noSearchResults') : t('noResults')}
        </p>
      ) : null}

      <p className={cn('pt-2 text-caption text-content-subtle', gutter)}>
        {t('rowCount', { count: filtered.length })}
      </p>
    </section>
  )
}
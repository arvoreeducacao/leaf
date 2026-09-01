'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'
import {
  addDatabaseProperty,
  addSelectOption,
  changeDatabasePropertyType,
  createDatabaseRow,
  createDatabaseView,
  deleteDatabaseProperty,
  deleteDatabaseRow,
  deleteDatabaseView,
  renameDatabaseProperty,
  renameDatabaseRow,
  setDatabaseRowValue,
  updateDatabaseView,
} from '@/lib/database-actions'
import { parseOptions, serializeOptions } from '@/lib/database/values'
import {
  type ViewConfig,
  applyFilters,
  applySorts,
  boardPropertyOf,
  groupRows,
  parseViewConfig,
  visibleProperties,
} from '@/lib/database/views'
import type { DatabaseSnapshot } from '@/lib/databases'

import { BoardView } from './board-view'
import { TableView } from './table-view'
import type { DatabaseHandlers } from './types'
import { ViewToolbar } from './view-toolbar'

const configSaveDelay = 500

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
  const [configs, setConfigs] = useState<Record<string, ViewConfig>>(() =>
    Object.fromEntries(
      snapshot.views.map((view) => [view.id, parseViewConfig(view.config)]),
    ),
  )

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

  const config = activeView
    ? (configs[activeView.id] ?? parseViewConfig(activeView.config))
    : parseViewConfig(null)

  function persistConfig(viewId: string, next: ViewConfig) {
    const timers = saveTimers.current
    const running = timers.get(viewId)

    if (running) {
      clearTimeout(running)
    }

    timers.set(
      viewId,
      setTimeout(() => {
        timers.delete(viewId)
        void guard(() => updateDatabaseView(viewId, { config: next }))
      }, configSaveDelay),
    )
  }

  function changeConfig(next: ViewConfig) {
    if (!activeView) {
      return
    }

    setConfigs((current) => ({ ...current, [activeView.id]: next }))

    if (canEdit) {
      persistConfig(activeView.id, next)
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
              options: null,
              position: current.length,
              createdAt: new Date(),
            } satisfies DatabaseProperty,
          ])
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
                options:
                  type === 'select' || type === 'multiSelect'
                    ? item.options
                    : null,
              }
            : item,
        ),
      )

      void guard(() => changeDatabasePropertyType(propertyId, type))
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
        setConfigs((current) => ({
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

    if (activeViewId === viewId) {
      setActiveViewId(remaining[0]?.id ?? '')
    }

    void guard(() => deleteDatabaseView(viewId))
  }

  const shown = useMemo(
    () => visibleProperties(properties, config),
    [config, properties],
  )

  const filtered = useMemo(
    () => applySorts(applyFilters(rows, config.filters, properties), config.sorts, properties),
    [config.filters, config.sorts, properties, rows],
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
    () => groupRows(filtered, resolvedGroupProperty, t('noValue')),
    [filtered, resolvedGroupProperty, t],
  )

  if (!activeView) {
    return null
  }

  return (
    <section className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
      <ViewToolbar
        activeViewId={activeView.id}
        canEdit={canEdit}
        config={config}
        onConfigChange={changeConfig}
        onCreateView={createView}
        onDeleteView={deleteView}
        onRenameView={renameView}
        groupPropertyId={
          activeView.type === 'board' ? (resolvedGroupProperty?.id ?? null) : null
        }
        onSelectView={setActiveViewId}
        properties={properties}
        views={views}
      />

      {rows.length === 0 ? (
        <p className="px-2 text-body-small text-content">
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
          properties={shown}
        />
      ) : (
        <TableView
          canEdit={canEdit}
          handlers={handlers}
          properties={shown}
          rows={filtered}
        />
      )}

      {filtered.length === 0 && rows.length > 0 ? (
        <p className="px-2 text-body-small text-content">{t('noResults')}</p>
      ) : null}

      <p className="px-2 text-caption text-content-subtle">
        {t('rowCount', { count: rows.length })}
      </p>
    </section>
  )
}
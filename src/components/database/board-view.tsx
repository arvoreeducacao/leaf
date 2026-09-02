'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { AddIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import { valueOf, valueToText } from '@/lib/database/values'
import type { BoardGroup, DatabaseRow } from '@/lib/database/views'
import { isMultiValueType } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { PropertyIcon } from './property-icon'
import { RowMenu } from './row-menu'
import type { RowMoveTarget } from './row-menu'
import { OptionChip, PersonChip } from './select-editor'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  groups: ReadonlyArray<BoardGroup>
  groupProperty: DatabaseProperty | null
  properties: ReadonlyArray<DatabaseProperty>
  canEdit: boolean
  handlers: DatabaseHandlers
  people: ReadonlyArray<Person>
}>

export function BoardView({
  groups,
  groupProperty,
  properties,
  canEdit,
  handlers,
  people,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const [dragging, setDragging] = useState<{
    rowId: string
    fromGroupId: string | null
  } | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const cardProperties = properties.filter(
    (property) => property.id !== groupProperty?.id,
  )

  const moveTargets =
    groupProperty && canEdit
      ? groups.map((group) => ({ id: group.id, name: group.name }))
      : undefined

  function move(row: DatabaseRow, from: string | null, to: string | null) {
    if (!groupProperty || !canEdit || from === to) {
      return
    }

    if (!isMultiValueType(groupProperty.type)) {
      handlers.commitValue(row.id, groupProperty.id, to)

      return
    }

    const current = row.values[groupProperty.id]
    const held = Array.isArray(current)
      ? current.filter((item): item is string => typeof item === 'string')
      : []
    const without = from === null ? held : held.filter((item) => item !== from)
    const next =
      to !== null && !without.includes(to) ? [...without, to] : without

    handlers.commitValue(row.id, groupProperty.id, next)
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative flex min-w-max items-start gap-3">
        {groups.map((group) => {
          const key = group.id ?? 'none'

          return (
            <section
              aria-label={group.name}
              className={cn(
                'flex w-72 shrink-0 flex-col gap-2 rounded-large border p-2 transition-colors',
                over === key
                  ? 'border-line-contrast bg-surface-hover'
                  : 'border-line bg-surface-subtle/60',
              )}
              key={key}
              onDragLeave={() => setOver((current) => (current === key ? null : current))}
              onDragOver={(event) => {
                if (!dragging || !groupProperty) {
                  return
                }

                event.preventDefault()
                setOver(key)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setOver(null)

                if (dragging) {
                  const held = groups
                    .flatMap((item) =>
                      item.rows.map((row) => ({ row, groupId: item.id })),
                    )
                    .find((item) => item.row.id === dragging.rowId)

                  if (held) {
                    move(held.row, dragging.fromGroupId, group.id)
                  }

                  setDragging(null)
                }
              }}
            >
              <header className="flex items-center gap-2 px-1">
                {group.id && group.color ? (
                  groupProperty?.type === 'person' ? (
                    <PersonChip
                      option={{
                        id: group.id,
                        name: group.name,
                        color: group.color,
                      }}
                    />
                  ) : (
                    <OptionChip
                      option={{
                        id: group.id,
                        name: group.name,
                        color: group.color,
                      }}
                    />
                  )
                ) : (
                  <span className="font-bold text-body-small text-content">
                    {group.name}
                  </span>
                )}
                <span className="text-caption text-content-subtle">
                  {group.rows.length}
                </span>
              </header>

              <ul className="flex flex-col gap-2">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <BoardCard
                      canEdit={canEdit}
                      handlers={handlers}
                      locale={locale}
                      moveTargets={moveTargets}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                      onDragStart={() =>
                        setDragging({ rowId: row.id, fromGroupId: group.id })
                      }
                      onMove={(groupId) => move(row, group.id, groupId)}
                      people={people}
                      properties={cardProperties}
                      row={row}
                      sortable={groupProperty !== null && canEdit}
                    />
                  </li>
                ))}
              </ul>

              {canEdit ? (
                <button
                  className="flex h-10 tablet:h-8 w-full cursor-pointer items-center gap-2 rounded-medium px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                  onClick={() =>
                    handlers.createRow(
                      groupProperty && group.id
                        ? { [groupProperty.id]: group.id }
                        : {},
                    )
                  }
                  type="button"
                >
                  <AddIcon aria-hidden="true" className="size-4" />
                  {t('newRowShort')}
                </button>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function BoardCard({
  row,
  properties,
  moveTargets,
  canEdit,
  sortable,
  locale,
  handlers,
  people,
  onMove,
  onDragStart,
  onDragEnd,
}: Readonly<{
  row: DatabaseRow
  properties: ReadonlyArray<DatabaseProperty>
  moveTargets: ReadonlyArray<RowMoveTarget> | undefined
  canEdit: boolean
  sortable: boolean
  locale: string
  handlers: DatabaseHandlers
  people: ReadonlyArray<Person>
  onMove: (groupId: string | null) => void
  onDragStart: () => void
  onDragEnd: () => void
}>) {
  const t = useTranslations('database')
  const title = row.title.trim().length > 0 ? row.title : t('untitledRow')

  return (
    <article
      className="flex flex-col gap-2 rounded-large border border-line bg-surface-card p-3 shadow-down-small transition-colors hover:border-line-strong"
      draggable={sortable}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', row.id)
        onDragStart()
      }}
    >
      <div className="flex items-start gap-1">
        <Link
          className="min-w-0 flex-1 rounded-medium font-bold text-body-small text-content-strong transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          href={`/doc/${row.id}`}
        >
          {title}
        </Link>
        <RowMenu
          canEdit={canEdit}
          moveTargets={moveTargets}
          onDelete={() => handlers.deleteRow(row.id)}
          onMove={onMove}
          rowId={row.id}
          title={row.title}
        />
      </div>

      <dl className="flex flex-col gap-1">
        {properties.map((property) => {
          const options = optionsFor(property, people)
          const value = valueOf(row.values, property, options)
          const text = valueToText(value, property.type, options, locale)

          if (text.length === 0) {
            return null
          }

          return (
            <div className="flex items-center gap-2" key={property.id}>
              <dt className="flex shrink-0 items-center gap-1 text-caption text-content-subtle">
                <PropertyIcon className="size-3.5" type={property.type} />
                <span className="sr-only">{property.name}</span>
              </dt>
              <dd className="min-w-0 flex-1 truncate text-caption text-content">
                {property.type === 'select' ||
                property.type === 'multiSelect' ||
                property.type === 'status' ||
                property.type === 'person'
                  ? (Array.isArray(value) ? value : [value]).map((id) => {
                      const option = options.find((item) => item.id === id)

                      if (!option) {
                        return null
                      }

                      return property.type === 'person' ? (
                        <PersonChip key={option.id} option={option} />
                      ) : (
                        <OptionChip key={option.id} option={option} />
                      )
                    })
                  : text}
              </dd>
            </div>
          )
        })}
      </dl>

    </article>
  )
}

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { DatabaseProperty } from '@/db/schema'
import {
  type TimelineBar,
  type TimelineColumn,
  type TimelineScale,
  addDays,
  dayWidthOf,
  daysBetween,
  localIsoDate,
  timelineColumnsOf,
  timelineSpanOf,
  toIsoDate,
  todayOffsetOf,
} from '@/lib/database/calendar'
import type { Person } from '@/lib/database/people'
import { parseOptions } from '@/lib/database/values'
import type { BoardGroup, DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { optionChipClass } from './option-colors'
import { OptionChip, PersonChip } from './select-editor'
import type { DatabaseHandlers } from './types'

const maxAvatars = 3

const plainBarClass =
  'bg-brand-surface text-brand hover:bg-brand-surface-strong'

type Lane = Readonly<{
  group: BoardGroup | null
  bars: ReadonlyArray<TimelineBar>
}>

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  startProperty: DatabaseProperty | null
  endProperty: DatabaseProperty | null
  groups: ReadonlyArray<BoardGroup> | null
  groupProperty: DatabaseProperty | null
  colorProperty: DatabaseProperty | null
  peopleProperty: DatabaseProperty | null
  people: ReadonlyArray<Person>
  scale: TimelineScale
  canEdit: boolean
  showPageIcon: boolean
  handlers: DatabaseHandlers
  compact?: boolean
}>

export function TimelineView({
  rows,
  startProperty,
  endProperty,
  groups,
  groupProperty,
  colorProperty,
  peopleProperty,
  people,
  scale,
  showPageIcon,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const rendered = useRef(toIsoDate(Date.now()))
  const [today, setToday] = useState(rendered.current)
  const track = useRef<HTMLDivElement>(null)
  const dayWidth = dayWidthOf[scale]

  useEffect(() => {
    const local = localIsoDate()

    if (local !== rendered.current) {
      setToday(local)
    }
  }, [])

  const span = useMemo(
    () => timelineSpanOf(rows, startProperty, endProperty, today, scale),
    [endProperty, rows, scale, startProperty, today],
  )

  const lanes = useMemo<ReadonlyArray<Lane>>(() => {
    if (!groups) {
      return [{ group: null, bars: span.bars }]
    }

    const barsByRow = new Map(span.bars.map((bar) => [bar.row.id, bar]))

    return groups
      .map((group) => ({
        group,
        bars: group.rows.flatMap((row) => barsByRow.get(row.id) ?? []),
      }))
      .filter((lane) => lane.bars.length > 0)
  }, [groups, span.bars])

  const columns = useMemo(
    () => timelineColumnsOf(span.from, span.days, scale),
    [scale, span.days, span.from],
  )

  const firstDay = span.bars.reduce(
    (earliest, bar) => Math.min(earliest, bar.offset),
    daysBetween(span.from, today),
  )

  useEffect(() => {
    const element = track.current

    if (!element) {
      return
    }

    element.scrollLeft = Math.max(0, (firstDay - 1) * dayWidth)
  }, [dayWidth, firstDay])

  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const shortMonthFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  })
  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    timeZone: 'UTC',
  })
  const dayMonthFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  })

  const colorOptions = useMemo(
    () => (colorProperty ? parseOptions(colorProperty.options) : []),
    [colorProperty],
  )
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  )

  if (!startProperty) {
    return (
      <p
        className={cn(
          'py-3 text-body-small text-content',
          compact ? '' : 'px-4 tablet:px-24',
        )}
      >
        {t('noDateProperty')}
      </p>
    )
  }

  function toDate(iso: string): Date {
    return new Date(`${iso}T00:00:00Z`)
  }

  function headLabelOf(column: TimelineColumn): string {
    return scale === 'month'
      ? column.start.slice(0, 4)
      : monthFormat.format(toDate(column.start))
  }

  function unitLabelOf(column: TimelineColumn): string {
    if (scale === 'day') {
      return dayFormat.format(toDate(column.start))
    }

    if (scale === 'month') {
      return shortMonthFormat.format(toDate(column.start))
    }

    const last = addDays(column.start, column.days - 1)
    const format =
      column.start.slice(0, 7) === last.slice(0, 7) ? dayFormat : dayMonthFormat

    return `${format.format(toDate(column.start))} – ${format.format(toDate(last))}`
  }

  const heads: Array<{ label: string; days: number }> = []

  for (const column of columns) {
    const label = headLabelOf(column)
    const last = heads.at(-1)

    if (last && last.label === label) {
      last.days += column.days

      continue
    }

    heads.push({ label, days: column.days })
  }

  const todayOffset = todayOffsetOf(span, today)

  function barClassOf(row: DatabaseRow): string {
    if (!colorProperty) {
      return plainBarClass
    }

    const value = row.values[colorProperty.id]
    const chosen = Array.isArray(value) ? value[0] : value
    const option = colorOptions.find((item) => item.id === chosen)

    return option
      ? cn(optionChipClass[option.color], 'hover:opacity-90')
      : plainBarClass
  }

  function peopleOf(row: DatabaseRow): Array<Person> {
    if (!peopleProperty) {
      return []
    }

    const value = row.values[peopleProperty.id]
    const ids = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? [value]
        : []

    return ids.flatMap((id) => peopleById.get(id) ?? [])
  }

  function titleOf(row: DatabaseRow): string {
    return row.title.trim().length > 0 ? row.title : t('untitledRow')
  }

  return (
    <div className={cn('flex flex-col gap-2', compact ? '' : 'px-4 tablet:px-24')}>
      <div className="flex overflow-hidden rounded-large border border-line-divider">
        <div className="w-60 shrink-0 border-line-divider border-r">
          <div className="h-13 border-line-divider border-b" />
          {lanes.map((lane) => (
            <Fragment key={lane.group ? (lane.group.id ?? 'none') : 'all'}>
              {lane.group ? (
                <LaneHeader
                  count={lane.bars.length}
                  group={lane.group}
                  groupProperty={groupProperty}
                />
              ) : null}
              {lane.bars.map((bar) => (
                <div
                  className="flex h-9 items-center gap-1.5 border-line-divider border-b px-2 last:border-b-0"
                  key={bar.row.id}
                >
                  {showPageIcon ? (
                    <DocumentIcon
                      className="size-4 shrink-0 text-content-subtle"
                      icon={bar.row.icon}
                    />
                  ) : null}
                  <Link
                    className="min-w-0 truncate text-body-small text-content-strong transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                    href={`/doc/${bar.row.id}`}
                  >
                    {titleOf(bar.row)}
                  </Link>
                </div>
              ))}
            </Fragment>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto" ref={track}>
          <div className="relative" style={{ width: span.days * dayWidth }}>
            <div className="flex h-6 border-line-divider border-b">
              {heads.map((head, index) => (
                <span
                  className="shrink-0 truncate border-line-divider border-r px-2 text-caption text-content-subtle last:border-r-0 first-letter:uppercase"
                  key={`${head.label}-${index}`}
                  style={{ width: head.days * dayWidth }}
                >
                  {head.label}
                </span>
              ))}
            </div>
            <div className="flex h-7 border-line-divider border-b">
              {columns.map((column) => (
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center truncate text-caption',
                    scale === 'day' ? '' : 'border-line-divider border-r px-1 last:border-r-0',
                    scale === 'day' && column.start === today
                      ? 'font-bold text-brand'
                      : 'text-content-subtle',
                  )}
                  key={column.start}
                  style={{ width: column.days * dayWidth }}
                >
                  {unitLabelOf(column)}
                </span>
              ))}
            </div>

            {lanes.map((lane) => (
              <Fragment key={lane.group ? (lane.group.id ?? 'none') : 'all'}>
                {lane.group ? (
                  <div className="h-8 border-line-divider border-b bg-surface-subtle/60" />
                ) : null}
                {lane.bars.map((bar) => (
                  <div
                    className="relative h-9 border-line-divider border-b last:border-b-0"
                    key={bar.row.id}
                  >
                    <Link
                      className={cn(
                        'absolute top-1.5 flex h-6 items-center gap-1 rounded-pill px-2 text-body-small transition-colors focus-visible:outline-2 focus-visible:outline-focus',
                        barClassOf(bar.row),
                      )}
                      href={`/doc/${bar.row.id}`}
                      style={{
                        insetInlineStart: bar.offset * dayWidth + 2,
                        width: bar.length * dayWidth - 4,
                      }}
                      title={titleOf(bar.row)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {titleOf(bar.row)}
                      </span>
                      <BarPeople people={peopleOf(bar.row)} />
                    </Link>
                  </div>
                ))}
              </Fragment>
            ))}

            {todayOffset !== null ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-brand"
                style={{ insetInlineStart: todayOffset * dayWidth }}
              >
                <span className="-translate-x-1/2 absolute top-0.5 rounded-pill bg-brand px-1.5 font-bold text-[10px] text-content-inverse leading-4">
                  {t('today')}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {span.undated.length > 0 ? (
        <p className="text-caption text-content-subtle">
          {t('rowsWithoutDate', { count: span.undated.length })}
        </p>
      ) : null}
    </div>
  )
}

function LaneHeader({
  group,
  groupProperty,
  count,
}: Readonly<{
  group: BoardGroup
  groupProperty: DatabaseProperty | null
  count: number
}>) {
  const option =
    group.id && group.color
      ? { id: group.id, name: group.name, color: group.color }
      : null

  return (
    <div className="flex h-8 items-center gap-2 border-line-divider border-b bg-surface-subtle/60 px-2">
      {option ? (
        groupProperty?.type === 'person' ? (
          <PersonChip option={option} />
        ) : (
          <OptionChip option={option} />
        )
      ) : (
        <span className="truncate font-bold text-body-small text-content">
          {group.name}
        </span>
      )}
      <span className="text-caption text-content-subtle">{count}</span>
    </div>
  )
}

function BarPeople({ people }: Readonly<{ people: ReadonlyArray<Person> }>) {
  if (people.length === 0) {
    return null
  }

  const shown = people.slice(0, maxAvatars)
  const rest = people.length - shown.length

  return (
    <span className="flex shrink-0 items-center">
      {shown.map((person, index) => (
        <UserAvatar
          className={cn('size-5 ring-2 ring-surface-card', index > 0 ? '-ml-1.5' : null)}
          email={person.email}
          image={person.image}
          key={person.id}
          name={person.name}
          userId={person.id}
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-1 rounded-pill bg-surface-card px-1 text-caption text-content">
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

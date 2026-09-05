'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { ButtonIcon } from '@/components/ui/button-icon'
import type { DatabaseProperty } from '@/db/schema'
import {
  addDays,
  addMonths,
  daysInWeek,
  localIsoDate,
  monthGridOf,
  rowsByDate,
  startOfMonth,
  toIsoDate,
} from '@/lib/database/calendar'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { ChevronDownIcon } from './icons'
import { RowContextMenu } from './row-menu'
import type { DatabaseHandlers } from './types'

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  dateProperty: DatabaseProperty | null
  canEdit: boolean
  showPageIcon: boolean
  handlers: DatabaseHandlers
  compact?: boolean
}>

export function CalendarView({
  rows,
  dateProperty,
  canEdit,
  showPageIcon,
  handlers,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const rendered = useRef(toIsoDate(Date.now()))
  const [today, setToday] = useState(rendered.current)
  const [anchor, setAnchor] = useState(() => startOfMonth(rendered.current))

  useEffect(() => {
    const local = localIsoDate()

    if (local === rendered.current) {
      return
    }

    setToday(local)
    setAnchor(startOfMonth(local))
  }, [])

  const days = useMemo(() => monthGridOf(anchor), [anchor])
  const byDate = useMemo(
    () => rowsByDate(rows, dateProperty),
    [dateProperty, rows],
  )

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${anchor}T00:00:00Z`))

  const weekdayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  })

  const weekdays = Array.from({ length: daysInWeek }, (_, index) =>
    weekdayFormat
      .format(new Date(`${addDays('2026-01-04', index)}T00:00:00Z`))
      .replace(/\.$/, ''),
  )

  const month = anchor.slice(0, 7)

  if (!dateProperty) {
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

  return (
    <div className={cn('flex flex-col gap-2', compact ? '' : 'px-4 tablet:px-24')}>
      <header className="flex items-center gap-2">
        <h3 className="flex-1 font-medium text-body-small text-content-strong first-letter:uppercase">
          {monthLabel}
        </h3>
        <ButtonIcon
          aria-label={t('previousMonth')}
          className="size-9 rounded-large p-1.5 tablet:size-7"
          onClick={() => setAnchor((current) => addMonths(current, -1))}
          size="medium"
          variant="ghost"
        >
          <ChevronDownIcon aria-hidden="true" className="rotate-90" />
        </ButtonIcon>
        <button
          className="flex h-9 cursor-pointer items-center rounded-large px-2 text-body-small text-content transition-colors tablet:h-7 hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => setAnchor(startOfMonth(today))}
          type="button"
        >
          {t('today')}
        </button>
        <ButtonIcon
          aria-label={t('nextMonth')}
          className="size-9 rounded-large p-1.5 tablet:size-7"
          onClick={() => setAnchor((current) => addMonths(current, 1))}
          size="medium"
          variant="ghost"
        >
          <ChevronDownIcon aria-hidden="true" className="-rotate-90" />
        </ButtonIcon>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-160 rounded-large border border-line-divider">
          <div className="grid grid-cols-7">
            {weekdays.map((weekday) => (
              <span
                className="border-line-divider border-r border-b px-2 py-1 text-caption text-content-subtle uppercase last:border-r-0"
                key={weekday}
              >
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.startsWith(month)
              const dayRows = byDate.get(day) ?? []

              return (
                <div
                  className={cn(
                    'group/day flex min-h-24 flex-col gap-1 border-line-divider border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                    inMonth ? '' : 'bg-surface-sunken',
                  )}
                  key={day}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center self-start rounded-circular text-caption',
                      day === today
                        ? 'bg-brand text-content-inverse'
                        : inMonth
                          ? 'text-content'
                          : 'text-content-disabled',
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>

                  {dayRows.map((row) => (
                    <RowContextMenu
                      canEdit={canEdit}
                      key={row.id}
                      onDelete={() => handlers.deleteRow(row.id)}
                      rowId={row.id}
                      title={row.title}
                    >
                      <Link
                        className="flex items-center gap-1 rounded-medium bg-surface-hover px-1.5 py-1 text-caption text-content-strong transition-colors hover:bg-surface-active focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                        href={`/doc/${row.id}`}
                      >
                        {showPageIcon ? (
                          <DocumentIcon
                            className="size-3.5 shrink-0 text-content-subtle"
                            icon={row.icon}
                          />
                        ) : null}
                        <span className="min-w-0 truncate">
                          {row.title.trim().length > 0
                            ? row.title
                            : t('untitledRow')}
                        </span>
                      </Link>
                    </RowContextMenu>
                  ))}

                  {canEdit ? (
                    <button
                      aria-label={t('newRowOn', { date: day })}
                      className="mt-auto h-6 cursor-pointer rounded-medium text-content-subtle text-left text-caption opacity-0 transition-opacity hover:bg-surface-hover group-hover/day:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                      onClick={() =>
                        handlers.createRow({ [dateProperty.id]: day })
                      }
                      type="button"
                    >
                      <span className="px-1.5">+</span>
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

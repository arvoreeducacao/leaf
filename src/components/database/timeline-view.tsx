'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import type { DatabaseProperty } from '@/db/schema'
import {
  addDays,
  daysBetween,
  localIsoDate,
  timelineSpanOf,
  toIsoDate,
} from '@/lib/database/calendar'
import type { DatabaseRow } from '@/lib/database/views'
import { cn } from '@/shared/utils'

import type { DatabaseHandlers } from './types'

const dayWidth = 32

type Props = Readonly<{
  rows: ReadonlyArray<DatabaseRow>
  startProperty: DatabaseProperty | null
  endProperty: DatabaseProperty | null
  canEdit: boolean
  showPageIcon: boolean
  handlers: DatabaseHandlers
  compact?: boolean
}>

export function TimelineView({
  rows,
  startProperty,
  endProperty,
  showPageIcon,
  compact = false,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const rendered = useRef(toIsoDate(Date.now()))
  const [today, setToday] = useState(rendered.current)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const local = localIsoDate()

    if (local !== rendered.current) {
      setToday(local)
    }
  }, [])

  const span = useMemo(
    () => timelineSpanOf(rows, startProperty, endProperty, today),
    [endProperty, rows, startProperty, today],
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
  }, [firstDay])

  const days = useMemo(
    () => Array.from({ length: span.days }, (_, index) => addDays(span.from, index)),
    [span.days, span.from],
  )

  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

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

  const months: Array<{ label: string; from: number; length: number }> = []

  for (const [index, day] of days.entries()) {
    const label = monthFormat.format(new Date(`${day}T00:00:00Z`))
    const last = months.at(-1)

    if (last && last.label === label) {
      last.length += 1

      continue
    }

    months.push({ label, from: index, length: 1 })
  }

  return (
    <div className={cn('flex flex-col gap-2', compact ? '' : 'px-4 tablet:px-24')}>
      <div className="flex overflow-hidden rounded-large border border-line-divider">
        <div className="w-50 shrink-0 border-line-divider border-r">
          <div className="h-13 border-line-divider border-b" />
          {span.bars.map((bar) => (
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
                {bar.row.title.trim().length > 0
                  ? bar.row.title
                  : t('untitledRow')}
              </Link>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto" ref={track}>
          <div style={{ width: span.days * dayWidth }}>
            <div className="flex h-6 border-line-divider border-b">
              {months.map((month) => (
                <span
                  className="shrink-0 border-line-divider border-r px-2 text-caption text-content-subtle last:border-r-0 first-letter:uppercase"
                  key={`${month.label}-${month.from}`}
                  style={{ width: month.length * dayWidth }}
                >
                  {month.label}
                </span>
              ))}
            </div>
            <div className="flex h-7 border-line-divider border-b">
              {days.map((day) => (
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center text-caption',
                    day === today
                      ? 'font-bold text-brand'
                      : 'text-content-subtle',
                  )}
                  key={day}
                  style={{ width: dayWidth }}
                >
                  {Number(day.slice(8))}
                </span>
              ))}
            </div>

            {span.bars.map((bar) => (
              <div
                className="relative h-9 border-line-divider border-b last:border-b-0"
                key={bar.row.id}
              >
                <Link
                  className="absolute top-1.5 flex h-6 items-center rounded-pill bg-brand-surface px-2 text-body-small text-brand transition-colors hover:bg-brand-surface-strong focus-visible:outline-2 focus-visible:outline-focus"
                  href={`/doc/${bar.row.id}`}
                  style={{
                    insetInlineStart: bar.offset * dayWidth + 2,
                    width: bar.length * dayWidth - 4,
                  }}
                >
                  <span className="min-w-0 truncate">
                    {bar.row.title.trim().length > 0
                      ? bar.row.title
                      : t('untitledRow')}
                  </span>
                </Link>
              </div>
            ))}
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

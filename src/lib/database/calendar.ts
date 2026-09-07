import type { DatabaseProperty } from '@/db/schema'

import type { DatabaseRow, ViewConfig } from './views'

type DateColumn = Pick<DatabaseProperty, 'id' | 'type'>

export const dayMilliseconds = 86_400_000

export const weeksInGrid = 6

export const daysInWeek = 7

const isoPattern = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && isoPattern.test(value)
}

export function toUtc(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

export function toIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

export function localIsoDate(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(toUtc(iso) + days * dayMilliseconds)
}

export function addMonths(iso: string, months: number): string {
  const date = new Date(toUtc(iso))
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  )
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()

  return toIsoDate(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(date.getUTCDate(), lastDay),
    ),
  )
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonth(iso: string): string {
  const date = new Date(toUtc(iso))
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()

  return `${iso.slice(0, 7)}-${`${lastDay}`.padStart(2, '0')}`
}

export function startOfWeek(iso: string): string {
  const weekday = new Date(toUtc(iso)).getUTCDay()

  return addDays(iso, -((weekday + 6) % 7))
}

export type TimelineScale = 'day' | 'week' | 'month'

export const timelineScales: ReadonlyArray<TimelineScale> = [
  'day',
  'week',
  'month',
]

export const dayWidthOf: Record<TimelineScale, number> = {
  day: 32,
  week: 16,
  month: 5,
}

export function isTimelineScale(value: unknown): value is TimelineScale {
  return (
    typeof value === 'string' &&
    (timelineScales as ReadonlyArray<string>).includes(value)
  )
}

export function alignSpan(
  from: string,
  to: string,
  scale: TimelineScale,
): Readonly<{ from: string; to: string }> {
  if (scale === 'week') {
    return {
      from: startOfWeek(from),
      to: addDays(startOfWeek(to), daysInWeek - 1),
    }
  }

  if (scale === 'month') {
    return { from: startOfMonth(from), to: endOfMonth(to) }
  }

  return { from, to }
}

export type TimelineColumn = Readonly<{
  start: string
  days: number
  offset: number
}>

function nextColumnStart(start: string, scale: TimelineScale): string {
  if (scale === 'day') {
    return addDays(start, 1)
  }

  if (scale === 'week') {
    return addDays(startOfWeek(start), daysInWeek)
  }

  return addMonths(startOfMonth(start), 1)
}

export function timelineColumnsOf(
  from: string,
  days: number,
  scale: TimelineScale,
): Array<TimelineColumn> {
  const columns: Array<TimelineColumn> = []
  let offset = 0

  while (offset < days) {
    const start = addDays(from, offset)
    const length = Math.min(
      daysBetween(start, nextColumnStart(start, scale)),
      days - offset,
    )

    columns.push({ start, days: length, offset })
    offset += length
  }

  return columns
}

export function todayOffsetOf(
  span: Readonly<{ from: string; to: string }>,
  today: string,
): number | null {
  const time = toUtc(today)

  return time >= toUtc(span.from) && time <= toUtc(span.to)
    ? daysBetween(span.from, today)
    : null
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / dayMilliseconds)
}

export function monthGridOf(anchor: string): Array<string> {
  const first = startOfMonth(anchor)
  const lead = new Date(toUtc(first)).getUTCDay()
  const start = addDays(first, -lead)

  return Array.from({ length: weeksInGrid * daysInWeek }, (_, index) =>
    addDays(start, index),
  )
}

export function dateValueOf(
  row: DatabaseRow,
  property: DateColumn | null,
): string | null {
  if (!property) {
    return null
  }

  const value = row.values[property.id]

  return isIsoDate(value) ? value : null
}

export function datePropertyOf<Column extends DateColumn>(
  properties: ReadonlyArray<Column>,
  propertyId: string | null,
): Column | null {
  const dates = properties.filter((property) => property.type === 'date')

  return (
    dates.find((property) => property.id === propertyId) ?? dates[0] ?? null
  )
}

export function endPropertyOf<Column extends DateColumn>(
  properties: ReadonlyArray<Column>,
  propertyId: string | null,
): Column | null {
  return (
    properties.find(
      (property) => property.id === propertyId && property.type === 'date',
    ) ?? null
  )
}

export function rowsByDate(
  rows: ReadonlyArray<DatabaseRow>,
  property: DateColumn | null,
): Map<string, Array<DatabaseRow>> {
  const byDate = new Map<string, Array<DatabaseRow>>()

  for (const row of rows) {
    const date = dateValueOf(row, property)

    if (!date) {
      continue
    }

    const held = byDate.get(date)

    if (held) {
      held.push(row)

      continue
    }

    byDate.set(date, [row])
  }

  return byDate
}

export type TimelineBar = Readonly<{
  row: DatabaseRow
  start: string
  end: string
  offset: number
  length: number
}>

export type TimelineSpan = Readonly<{
  from: string
  to: string
  days: number
  bars: ReadonlyArray<TimelineBar>
  undated: ReadonlyArray<DatabaseRow>
}>

export function timelineSpanOf(
  rows: ReadonlyArray<DatabaseRow>,
  startProperty: DateColumn | null,
  endProperty: DateColumn | null,
  today: string,
  scale: TimelineScale = 'day',
): TimelineSpan {
  const dated: Array<{ row: DatabaseRow; start: string; end: string }> = []
  const undated: Array<DatabaseRow> = []

  for (const row of rows) {
    const start = dateValueOf(row, startProperty)

    if (!start) {
      undated.push(row)

      continue
    }

    const rawEnd = dateValueOf(row, endProperty)
    const end = rawEnd && toUtc(rawEnd) > toUtc(start) ? rawEnd : start

    dated.push({ row, start, end })
  }

  const anchor = startOfMonth(dated[0]?.start ?? today)
  const from = dated.reduce(
    (earliest, item) => (toUtc(item.start) < toUtc(earliest) ? item.start : earliest),
    anchor,
  )
  const to = dated.reduce(
    (latest, item) => (toUtc(item.end) > toUtc(latest) ? item.end : latest),
    addDays(from, daysInWeek * 4),
  )

  const aligned = alignSpan(from, to, scale)

  return {
    from: aligned.from,
    to: aligned.to,
    days: daysBetween(aligned.from, aligned.to) + 1,
    bars: dated.map((item) => ({
      row: item.row,
      start: item.start,
      end: item.end,
      offset: daysBetween(aligned.from, item.start),
      length: daysBetween(item.start, item.end) + 1,
    })),
    undated,
  }
}

export function calendarPropertiesOf<Column extends DateColumn>(
  properties: ReadonlyArray<Column>,
  config: ViewConfig,
): Readonly<{ start: Column | null; end: Column | null }> {
  return {
    start: datePropertyOf(properties, config.datePropertyId),
    end: endPropertyOf(properties, config.endDatePropertyId),
  }
}

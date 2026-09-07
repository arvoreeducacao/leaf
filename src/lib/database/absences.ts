import type { DatabaseProperty } from '@/db/schema'

import { dateValueOf, daysBetween, toUtc } from './calendar'
import type { Person } from './people'
import type { DatabaseRow } from './views'

type Column = Pick<DatabaseProperty, 'id' | 'type'>

export type AbsenceColumns = Readonly<{
  person: Column | null
  start: Column
  end: Column | null
}>

export type Absence = Readonly<{
  id: string
  label: string
  start: string
  end: string
  offset: number
  length: number
  personal: boolean
}>

export function absenceColumnsOf(
  properties: ReadonlyArray<Column>,
): AbsenceColumns | null {
  const dates = properties.filter((property) => property.type === 'date')
  const start = dates[0]

  if (!start) {
    return null
  }

  return {
    person: properties.find((property) => property.type === 'person') ?? null,
    start,
    end: dates[1] ?? null,
  }
}

function namesOf(
  row: DatabaseRow,
  column: Column | null,
  people: ReadonlyArray<Person>,
): Array<string> {
  if (!column) {
    return []
  }

  const value = row.values[column.id]
  const ids = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : []

  return ids.flatMap((id) => {
    const person = people.find((item) => item.id === id)

    return person ? [person.name] : []
  })
}

export function absencesOf(
  rows: ReadonlyArray<DatabaseRow>,
  columns: AbsenceColumns | null,
  people: ReadonlyArray<Person>,
  span: Readonly<{ from: string; to: string }>,
): Array<Absence> {
  if (!columns) {
    return []
  }

  const absences: Array<Absence> = []

  for (const row of rows) {
    const start = dateValueOf(row, columns.start)

    if (!start) {
      continue
    }

    const rawEnd = dateValueOf(row, columns.end)
    const end = rawEnd && toUtc(rawEnd) > toUtc(start) ? rawEnd : start

    if (toUtc(end) < toUtc(span.from) || toUtc(start) > toUtc(span.to)) {
      continue
    }

    const shownStart = toUtc(start) < toUtc(span.from) ? span.from : start
    const shownEnd = toUtc(end) > toUtc(span.to) ? span.to : end
    const names = namesOf(row, columns.person, people)
    const title = row.title.trim()

    absences.push({
      id: row.id,
      label:
        names.length > 0
          ? title.length > 0
            ? `${names.join(', ')} · ${title}`
            : names.join(', ')
          : title,
      start,
      end,
      offset: daysBetween(span.from, shownStart),
      length: daysBetween(shownStart, shownEnd) + 1,
      personal: names.length > 0,
    })
  }

  return absences.sort(
    (left, right) => left.offset - right.offset || left.length - right.length,
  )
}

const documentPathPattern = /\/doc\/([A-Za-z0-9_-]{12})(?:[/?#]|$)/

export function databaseIdFromLink(value: string): string | null {
  const trimmed = value.trim()
  const fromPath = trimmed.match(documentPathPattern)

  if (fromPath) {
    return fromPath[1]
  }

  return /^[A-Za-z0-9_-]{12}$/.test(trimmed) ? trimmed : null
}

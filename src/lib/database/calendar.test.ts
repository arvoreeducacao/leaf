import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  datePropertyOf,
  daysBetween,
  localIsoDate,
  monthGridOf,
  rowsByDate,
  startOfMonth,
  timelineSpanOf,
} from './calendar'
import type { DatabaseRow } from './views'

const due = { id: 'due', name: 'Prazo', type: 'date' as const, options: null }
const finish = {
  id: 'finish',
  name: 'Fim',
  type: 'date' as const,
  options: null,
}
const text = { id: 'text', name: 'Nota', type: 'text' as const, options: null }

function row(id: string, values: DatabaseRow['values']): DatabaseRow {
  return {
    id,
    title: id,
    icon: null,
    cover: null,
    values,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('walking the calendar', () => {
  it('crosses the end of the month and of the year', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-01-31', '2026-02-02')).toBe(2)
  })

  it('lands on the last day when the next month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15')
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01')
  })

  it('reads the day the reader is living, not the one in London', () => {
    expect(localIsoDate(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05')
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })

  it('opens the month on a sunday and fills six weeks', () => {
    const grid = monthGridOf('2026-09-17')

    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-08-30')
    expect(grid).toContain('2026-09-01')
    expect(grid).toContain('2026-09-30')
    expect(new Date(`${grid[0]}T00:00:00Z`).getUTCDay()).toBe(0)
  })
})

describe('rows on a day', () => {
  it('gathers only what carries a real date', () => {
    const rows = [
      row('a', { due: '2026-09-10' }),
      row('b', { due: '2026-09-10' }),
      row('c', { due: 'amanhã' }),
      row('d', {}),
    ]

    const byDate = rowsByDate(rows, due)

    expect(byDate.get('2026-09-10')?.map((item) => item.id)).toEqual(['a', 'b'])
    expect(byDate.size).toBe(1)
  })

  it('gathers nothing when the view has no date column', () => {
    expect(rowsByDate([row('a', { due: '2026-09-10' })], null).size).toBe(0)
  })
})

describe('choosing the date column', () => {
  it('falls back to the first date column when none was chosen', () => {
    expect(datePropertyOf([text, due, finish], null)?.id).toBe('due')
    expect(datePropertyOf([text, due, finish], 'finish')?.id).toBe('finish')
    expect(datePropertyOf([text], null)).toBeNull()
  })
})

describe('the timeline bars', () => {
  const rows = [
    row('a', { due: '2026-09-10', finish: '2026-09-12' }),
    row('b', { due: '2026-09-14' }),
    row('c', {}),
  ]

  it('measures each bar from the first day shown', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17')

    expect(span.from).toBe('2026-09-01')
    expect(span.bars.map((bar) => [bar.row.id, bar.offset, bar.length])).toEqual(
      [
        ['a', 9, 3],
        ['b', 13, 1],
      ],
    )
  })

  it('keeps a single day when the end comes before the start', () => {
    const backwards = [row('d', { due: '2026-09-10', finish: '2026-09-02' })]
    const span = timelineSpanOf(backwards, due, finish, '2026-09-17')

    expect(span.bars[0].length).toBe(1)
  })

  it('sets aside the rows with no date', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17')

    expect(span.undated.map((item) => item.id)).toEqual(['c'])
  })
})

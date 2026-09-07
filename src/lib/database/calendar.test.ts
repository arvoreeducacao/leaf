import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  baselinePropertiesOf,
  datePropertyOf,
  daysBetween,
  localIsoDate,
  monthGridOf,
  endOfMonth,
  rowsByDate,
  startOfMonth,
  startOfWeek,
  timelineColumnsOf,
  timelineSpanOf,
  todayOffsetOf,
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
const plannedStart = {
  id: 'plannedStart',
  name: 'Início planejado',
  type: 'date' as const,
  options: null,
}
const plannedEnd = {
  id: 'plannedEnd',
  name: 'Fim planejado',
  type: 'date' as const,
  options: null,
}

function row(id: string, values: DatabaseRow['values']): DatabaseRow {
  return {
    id,
    title: id,
    icon: null,
    cover: null,
    preview: null,
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

describe('the timeline by week and by month', () => {
  const rows = [
    row('a', { due: '2026-09-10', finish: '2026-09-12' }),
    row('b', { due: '2026-09-14' }),
  ]

  it('opens the week on a monday and closes it on a sunday', () => {
    expect(startOfWeek('2026-09-10')).toBe('2026-09-07')
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07')
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31')

    const span = timelineSpanOf(rows, due, finish, '2026-09-17', 'week')

    expect(span.from).toBe('2026-08-31')
    expect(span.to).toBe('2026-10-04')
    expect(span.days % 7).toBe(0)
    expect(span.bars[0].offset).toBe(10)
  })

  it('stretches the month scale to whole months', () => {
    expect(endOfMonth('2026-02-03')).toBe('2026-02-28')
    expect(endOfMonth('2028-02-03')).toBe('2028-02-29')

    const span = timelineSpanOf(rows, due, finish, '2026-09-17', 'month')

    expect(span.from).toBe('2026-09-01')
    expect(span.to).toBe('2026-09-30')
    expect(span.days).toBe(30)
  })

  it('cuts the columns by the scale', () => {
    expect(
      timelineColumnsOf('2026-08-31', 14, 'week').map((column) => [
        column.start,
        column.days,
        column.offset,
      ]),
    ).toEqual([
      ['2026-08-31', 7, 0],
      ['2026-09-07', 7, 7],
    ])
    expect(
      timelineColumnsOf('2026-09-01', 61, 'month').map((column) => [
        column.start,
        column.days,
      ]),
    ).toEqual([
      ['2026-09-01', 30],
      ['2026-10-01', 31],
    ])
    expect(timelineColumnsOf('2026-09-01', 3, 'day')).toHaveLength(3)
  })

  it('places today only when it falls inside the span', () => {
    const span = { from: '2026-09-01', to: '2026-09-30' }

    expect(todayOffsetOf(span, '2026-09-17')).toBe(16)
    expect(todayOffsetOf(span, '2026-09-01')).toBe(0)
    expect(todayOffsetOf(span, '2026-10-01')).toBeNull()
    expect(todayOffsetOf(span, '2026-08-31')).toBeNull()
  })
})

describe('the baseline under the bars', () => {
  const baseline = { start: plannedStart, end: plannedEnd }
  const rows = [
    row('a', {
      due: '2026-09-14',
      finish: '2026-09-18',
      plannedStart: '2026-09-07',
      plannedEnd: '2026-09-11',
    }),
    row('b', { plannedStart: '2026-09-21', plannedEnd: '2026-09-25' }),
    row('c', { due: '2026-09-28' }),
    row('d', {}),
  ]

  it('places the planned range next to the real one', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17', 'day', baseline)
    const first = span.bars[0]

    expect(first.dated).toBe(true)
    expect([first.offset, first.length]).toEqual([13, 5])
    expect(first.baseline).toMatchObject({ offset: 6, length: 5 })
  })

  it('shows a row that only has a plan as a planned bar, not as undated', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17', 'day', baseline)
    const planned = span.bars.find((bar) => bar.row.id === 'b')

    expect(planned?.dated).toBe(false)
    expect([planned?.offset, planned?.length]).toEqual([20, 5])
    expect(planned?.baseline).toMatchObject({ offset: 20, length: 5 })
    expect(span.undated.map((item) => item.id)).toEqual(['d'])
  })

  it('leaves the bar without a baseline when the row has no plan', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17', 'day', baseline)

    expect(span.bars.find((bar) => bar.row.id === 'c')?.baseline).toBeNull()
  })

  it('widens the span so the plan fits too', () => {
    const late = [row('e', { due: '2026-09-10', plannedStart: '2026-08-20' })]
    const span = timelineSpanOf(late, due, finish, '2026-09-17', 'day', baseline)

    expect(span.from).toBe('2026-08-20')
  })

  it('ignores the baseline when the view has none', () => {
    const span = timelineSpanOf(rows, due, finish, '2026-09-17')

    expect(span.bars.map((bar) => bar.row.id)).toEqual(['a', 'c'])
    expect(span.bars.every((bar) => bar.baseline === null)).toBe(true)
  })

  it('needs a planned start to exist and be a date', () => {
    expect(baselinePropertiesOf([due, plannedStart, plannedEnd], { baselineStartPropertyId: 'plannedStart', baselineEndPropertyId: 'plannedEnd' } as never)).toEqual({ start: plannedStart, end: plannedEnd })
    expect(baselinePropertiesOf([due, text], { baselineStartPropertyId: 'text', baselineEndPropertyId: null } as never)).toBeNull()
    expect(baselinePropertiesOf([due], { baselineStartPropertyId: null, baselineEndPropertyId: 'due' } as never)).toBeNull()
  })
})

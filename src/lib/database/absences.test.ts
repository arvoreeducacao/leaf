import { describe, expect, it } from 'vitest'

import { absenceColumnsOf, absencesOf, databaseIdFromLink } from './absences'
import type { DatabaseRow } from './views'

const who = { id: 'who', type: 'person' as const }
const from = { id: 'from', type: 'date' as const }
const until = { id: 'until', type: 'date' as const }
const kind = { id: 'kind', type: 'select' as const }

const people = [
  { id: 'u1', name: 'Laís', email: 'lais@example.com' },
  { id: 'u2', name: 'Mari', email: 'mari@example.com' },
]

function row(id: string, title: string, values: DatabaseRow['values']): DatabaseRow {
  return {
    id,
    title,
    icon: null,
    cover: null,
    preview: null,
    values,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const span = { from: '2026-09-07', to: '2026-10-23' }

describe('reading an absences database', () => {
  it('takes the first date as the start, the second as the end and the person column', () => {
    expect(absenceColumnsOf([kind, who, from, until])).toEqual({
      person: who,
      start: from,
      end: until,
    })
    expect(absenceColumnsOf([kind, from])).toEqual({ person: null, start: from, end: null })
    expect(absenceColumnsOf([kind, who])).toBeNull()
  })

  it('labels a personal absence by the people and a holiday by the title', () => {
    const absences = absencesOf(
      [
        row('a', 'Férias', { who: ['u1'], from: '2026-10-12', until: '2026-10-16' }),
        row('b', 'Feriado', { from: '2026-10-12' }),
        row('c', '', { who: ['u1', 'u2'], from: '2026-09-21', until: '2026-09-22' }),
      ],
      { person: who, start: from, end: until },
      people,
      span,
    )

    expect(absences.map((item) => [item.label, item.personal])).toEqual([
      ['Laís, Mari', true],
      ['Feriado', false],
      ['Laís · Férias', true],
    ])
  })

  it('clips to the span and drops what falls outside', () => {
    const absences = absencesOf(
      [
        row('a', 'Antes', { from: '2026-08-01', until: '2026-08-05' }),
        row('b', 'Atravessa', { from: '2026-09-01', until: '2026-09-09' }),
        row('c', 'Depois', { from: '2026-11-01' }),
        row('d', 'Sem data', {}),
      ],
      { person: null, start: from, end: until },
      people,
      span,
    )

    expect(absences.map((item) => [item.id, item.offset, item.length])).toEqual([
      ['b', 0, 3],
    ])
  })

  it('keeps a single day when the end comes before the start', () => {
    const [absence] = absencesOf(
      [row('a', 'Erro', { from: '2026-09-10', until: '2026-09-02' })],
      { person: null, start: from, end: until },
      people,
      span,
    )

    expect(absence.length).toBe(1)
    expect(absence.end).toBe('2026-09-10')
  })
})

describe('the link of the absences database', () => {
  it('reads the id out of a document link or accepts the id alone', () => {
    expect(databaseIdFromLink('https://leaf.example.com/doc/_xwGJje-ISrq?v=abc')).toBe('_xwGJje-ISrq')
    expect(databaseIdFromLink('  _xwGJje-ISrq ')).toBe('_xwGJje-ISrq')
    expect(databaseIdFromLink('https://leaf.example.com/doc/short')).toBeNull()
    expect(databaseIdFromLink('nada a ver')).toBeNull()
  })
})

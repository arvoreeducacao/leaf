import { describe, expect, it } from 'vitest'

import { personOptions } from './people'
import { serializeUniqueIdConfig } from './unique-id'
import { serializeOptions, valueToText } from './values'
import {
  TITLE_PROPERTY_ID,
  type DatabaseRow,
  type ViewConfig,
  applyFilters,
  applySearch,
  applySorts,
  boardPropertyOf,
  emptyViewConfig,
  filterValueFor,
  groupRows,
  operatorsFor,
  parseViewConfig,
  serializeViewConfig,
  visibleProperties,
} from './views'

const status = {
  id: 'status',
  type: 'select' as const,
  options: serializeOptions([
    { id: 'todo', name: 'To do', color: 'gray' },
    { id: 'done', name: 'Done', color: 'success' },
  ]),
}

const owners = { id: 'owners', type: 'person' as const, options: null }

const phase = {
  id: 'phase',
  type: 'status' as const,
  options: serializeOptions([
    { id: 'f', name: 'Done', color: 'success', group: 'done' },
    { id: 'p', name: 'Pending', color: 'gray', group: 'todo' },
    { id: 'a', name: 'Running', color: 'blue', group: 'doing' },
  ]),
}

const people = personOptions([
  { id: 'u1', name: 'Rafael', email: 'rafael@arvore.com.br' },
  { id: 'u2', name: 'Raposo', email: 'raposo@arvore.com.br' },
])

const points = { id: 'points', type: 'number' as const, options: null }
const due = { id: 'due', type: 'date' as const, options: null }
const done = { id: 'done', type: 'checkbox' as const, options: null }

const properties = [status, points, due, done]

function row(
  id: string,
  title: string,
  values: DatabaseRow['values'],
): DatabaseRow {
  return {
    id,
    title,
    icon: null,
    values,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const rows = [
  row('a', 'Alfa', { status: 'todo', points: 3, due: '2026-03-10', done: true }),
  row('b', 'Beta', { status: 'done', points: 10, due: '2026-01-05' }),
  row('c', 'Gama', {}),
]

describe('view configuration', () => {
  it('returns an empty configuration when the json is broken', () => {
    expect(parseViewConfig('{')).toEqual(emptyViewConfig)
    expect(parseViewConfig('[]')).toEqual(emptyViewConfig)
    expect(parseViewConfig(null)).toEqual(emptyViewConfig)
  })

  it('drops a filter and a sort with an invalid shape', () => {
    const parsed = parseViewConfig(
      JSON.stringify({
        filters: [
          { propertyId: 'status', operator: 'is', value: 'todo' },
          { propertyId: 'status', operator: 'made-up' },
          { operator: 'is' },
        ],
        sorts: [
          { propertyId: 'points', direction: 'desc' },
          { propertyId: 'points', direction: 'sideways' },
        ],
        hiddenPropertyIds: ['due', 7],
      }),
    )

    expect(parsed.filters).toHaveLength(1)
    expect(parsed.sorts).toEqual([{ propertyId: 'points', direction: 'desc' }])
    expect(parsed.hiddenPropertyIds).toEqual(['due'])
  })

  it('round-trips the configuration', () => {
    const config: ViewConfig = {
      groupByPropertyId: 'status',
      filters: [{ propertyId: 'points', operator: 'greaterThan', value: 2 }],
      sorts: [{ propertyId: TITLE_PROPERTY_ID, direction: 'asc' }],
      hiddenPropertyIds: ['due'],
      wrapCells: true,
    }

    expect(parseViewConfig(serializeViewConfig(config))).toEqual(config)
  })

  it('offers only the operators that make sense for each type', () => {
    expect(operatorsFor('checkbox')).toEqual(['is'])
    expect(operatorsFor('date')).toContain('before')
    expect(operatorsFor('number')).toContain('greaterThan')
    expect(operatorsFor('select')).not.toContain('contains')
  })
})

describe('filters', () => {
  it('filters by select, number, date and checkbox', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'status', operator: 'is', value: 'todo' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a'])

    expect(
      applyFilters(
        rows,
        [{ propertyId: 'points', operator: 'greaterThan', value: 5 }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['b'])

    expect(
      applyFilters(
        rows,
        [{ propertyId: 'due', operator: 'before', value: '2026-02-01' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['b'])

    expect(
      applyFilters(
        rows,
        [{ propertyId: 'done', operator: 'is', value: true }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a'])
  })

  it('filters by the row title', () => {
    expect(
      applyFilters(
        rows,
        [
          {
            propertyId: TITLE_PROPERTY_ID,
            operator: 'contains',
            value: 'ga',
          },
        ],
        properties,
      ).map((item) => item.id),
    ).toEqual(['c'])
  })

  it('handles empty and not empty', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'points', operator: 'isEmpty', value: null }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['c'])

    expect(
      applyFilters(
        rows,
        [{ propertyId: 'status', operator: 'isNotEmpty', value: null }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b'])
  })

  it('ignores a filter on a property that was deleted', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'gone', operator: 'is', value: 'x' }],
        properties,
      ),
    ).toHaveLength(3)
  })

  it('requires every filter to pass', () => {
    expect(
      applyFilters(
        rows,
        [
          { propertyId: 'status', operator: 'isNotEmpty', value: null },
          { propertyId: 'points', operator: 'greaterThan', value: 5 },
        ],
        properties,
      ).map((item) => item.id),
    ).toEqual(['b'])
  })
})

describe('sorting', () => {
  it('sorts by number and pushes the empty one to the end both ways', () => {
    expect(
      applySorts(
        rows,
        [{ propertyId: 'points', direction: 'asc' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])

    expect(
      applySorts(
        rows,
        [{ propertyId: 'points', direction: 'desc' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['b', 'a', 'c'])
  })

  it('sorts by title respecting the accent', () => {
    const accented = [
      row('1', 'Zebra', {}),
      row('2', 'Água', {}),
      row('3', 'Banana', {}),
    ]

    expect(
      applySorts(
        accented,
        [{ propertyId: TITLE_PROPERTY_ID, direction: 'asc' }],
        properties,
      ).map((item) => item.title),
    ).toEqual(['Água', 'Banana', 'Zebra'])
  })

  it('sorts a select by the option order, not by the text', () => {
    expect(
      applySorts(
        rows,
        [{ propertyId: 'status', direction: 'asc' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('board', () => {
  it('groups by select and keeps a column for whoever has no value', () => {
    const groups = groupRows(rows, status, 'No value')

    expect(groups.map((group) => group.name)).toEqual([
      'To do',
      'Done',
      'No value',
    ])
    expect(groups[0].rows.map((item) => item.id)).toEqual(['a'])
    expect(groups[2].rows.map((item) => item.id)).toEqual(['c'])
  })

  it('falls back to a single column when there is no grouping property', () => {
    const groups = groupRows(rows, null, 'No value')

    expect(groups).toHaveLength(1)
    expect(groups[0].rows).toHaveLength(3)
  })

  it('picks the first select when the configured one does not fit', () => {
    expect(
      boardPropertyOf(properties, {
        ...emptyViewConfig,
        groupByPropertyId: 'points',
      })?.id,
    ).toBe('status')

    expect(boardPropertyOf([points], emptyViewConfig)).toBeNull()
  })
})

describe('visible properties', () => {
  it('takes the hidden ones out of the view', () => {
    expect(
      visibleProperties(properties, {
        ...emptyViewConfig,
        hiddenPropertyIds: ['due', 'done'],
      }).map((item) => item.id),
    ).toEqual(['status', 'points'])
  })
})

describe('board by person', () => {
  const shared = [
    row('a', 'Alfa', { owners: ['u1', 'u2'] }),
    row('b', 'Beta', { owners: ['u2'] }),
    row('c', 'Gama', { owners: [] }),
  ]

  it('puts the row in the column of every person on it', () => {
    const groups = groupRows(shared, owners, 'No owner', people)

    expect(groups.map((group) => group.name)).toEqual([
      'Rafael',
      'Raposo',
      'No owner',
    ])
    expect(groups[0].rows.map((item) => item.id)).toEqual(['a'])
    expect(groups[1].rows.map((item) => item.id)).toEqual(['a', 'b'])
    expect(groups[2].rows.map((item) => item.id)).toEqual(['c'])
  })

  it('sends to the empty column whoever points at people who left the organization', () => {
    const groups = groupRows(
      [row('x', 'Orphan', { owners: ['gone'] })],
      owners,
      'No owner',
      people,
    )

    expect(groups[groups.length - 1].rows.map((item) => item.id)).toEqual(['x'])
  })

  it('accepts a person as the grouping property', () => {
    expect(
      boardPropertyOf([points, owners], {
        ...emptyViewConfig,
        groupByPropertyId: 'owners',
      })?.id,
    ).toBe('owners')
  })

  it('orders the status columns by todo, doing and done', () => {
    const groups = groupRows(
      [row('a', 'Alfa', { phase: 'f' }), row('b', 'Beta', { phase: 'p' })],
      phase,
      'No value',
    )

    expect(groups.map((group) => group.name)).toEqual([
      'Pending',
      'Running',
      'Done',
      'No value',
    ])
  })
})

describe('is me filter', () => {
  const mine = [
    row('a', 'Alfa', { owners: ['u1', 'u2'] }),
    row('b', 'Beta', { owners: ['u2'] }),
    row('c', 'Gama', {}),
  ]

  const filter = {
    propertyId: 'owners',
    operator: 'isMe' as const,
    value: null,
  }

  it('lets through only what belongs to whoever is looking', () => {
    expect(
      applyFilters(mine, [filter], [owners], 'u1').map((item) => item.id),
    ).toEqual(['a'])

    expect(
      applyFilters(mine, [filter], [owners], 'u2').map((item) => item.id),
    ).toEqual(['a', 'b'])
  })

  it('lets nothing through when nobody is signed in', () => {
    expect(applyFilters(mine, [filter], [owners], null)).toEqual([])
  })

  it('offers is me as a person operator and not a select one', () => {
    expect(operatorsFor('person')).toContain('isMe')
    expect(operatorsFor('select')).not.toContain('isMe')
  })
})


const ticket = {
  id: 'ticket',
  type: 'uniqueId' as const,
  options: serializeUniqueIdConfig({ prefix: 'PROP', next: 12 }),
}

const tickets = [
  row('a', 'Alfa', { ticket: 9 }),
  row('b', 'Beta', { ticket: 10 }),
  row('c', 'Gama', { ticket: 11 }),
]

describe('the id column', () => {
  it('orders by the number and not by the text of it', () => {
    expect(
      applySorts(
        [tickets[2], tickets[0], tickets[1]],
        [{ propertyId: 'ticket', direction: 'asc' }],
        [ticket],
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])
  })

  it('accepts the number typed with or without the prefix', () => {
    const typed = applyFilters(
      tickets,
      [{ propertyId: 'ticket', operator: 'is', value: 'PROP-10' }],
      [ticket],
    )

    expect(typed.map((item) => item.id)).toEqual(['b'])

    const bare = applyFilters(
      tickets,
      [{ propertyId: 'ticket', operator: 'is', value: '10' }],
      [ticket],
    )

    expect(bare.map((item) => item.id)).toEqual(['b'])
  })

  it('compares greater than as a number, so 9 does not beat 10', () => {
    expect(
      applyFilters(
        tickets,
        [{ propertyId: 'ticket', operator: 'greaterThan', value: '9' }],
        [ticket],
      ).map((item) => item.id),
    ).toEqual(['b', 'c'])
  })

  it('searches inside the text the person actually sees', () => {
    expect(
      applyFilters(
        tickets,
        [{ propertyId: 'ticket', operator: 'contains', value: 'prop-1' }],
        [ticket],
      ).map((item) => item.id),
    ).toEqual(['b', 'c'])
  })

  it('is never offered as something to group a board by', () => {
    expect(operatorsFor('uniqueId')).toContain('is')
    expect(operatorsFor('uniqueId')).not.toContain('isEmpty')
  })
})


describe('the search inside a database', () => {
  const searchRows = [
    row('a', 'Relatório de leitura', { status: 'todo', points: 3 }),
    row('b', 'Plano de aula', { status: 'done', points: 10 }),
    row('c', 'Sem nada', {}),
  ]

  it('gives everything back when nobody typed anything', () => {
    expect(applySearch(searchRows, '   ', properties).map((i) => i.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('finds by a piece of the name, ignoring accent and case', () => {
    expect(applySearch(searchRows, 'RELATORIO', properties).map((i) => i.id)).toEqual(
      ['a'],
    )
  })

  it('finds by what a column shows, not only by the name', () => {
    expect(applySearch(searchRows, 'Done', properties).map((i) => i.id)).toEqual([
      'b',
    ])
  })

  it('finds by a number the way the person reads it', () => {
    expect(applySearch(searchRows, '10', properties).map((i) => i.id)).toEqual(['b'])
  })

  it('gives nothing back when the word is in no row', () => {
    expect(applySearch(searchRows, 'planilha', properties)).toEqual([])
  })
})

describe('a filter that is still being set up', () => {
  it('does not hide anything while nobody chose a value', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'status', operator: 'is', value: null }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])

    expect(
      applyFilters(
        rows,
        [{ propertyId: TITLE_PROPERTY_ID, operator: 'contains', value: '' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])
  })

  it('still lets the unchecked box be a real filter', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'done', operator: 'is', value: false }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['b', 'c'])
  })

  it('keeps filtering the moment a value shows up', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'status', operator: 'is', value: 'todo' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a'])
  })
})

describe('wrapping cells', () => {
  it('wraps by default, the way a new view arrives', () => {
    expect(parseViewConfig(null).wrapCells).toBe(true)
    expect(parseViewConfig('{"filters":[]}').wrapCells).toBe(true)
  })

  it('keeps the choice of not wrapping across a round trip', () => {
    const config: ViewConfig = { ...emptyViewConfig, wrapCells: false }

    expect(parseViewConfig(serializeViewConfig(config)).wrapCells).toBe(false)
  })
})

describe('the label of a filter on a multi value column', () => {
  const cycles = {
    id: 'cycles',
    type: 'multiSelect' as const,
    options: serializeOptions([
      { id: 'c1', name: '2026-05', color: 'purple' },
      { id: 'c2', name: '2026-06', color: 'blue' },
    ]),
  }

  const options = [
    { id: 'c1', name: '2026-05', color: 'purple' as const },
    { id: 'c2', name: '2026-06', color: 'blue' as const },
  ]

  it('reads the single option the filter editor writes', () => {
    expect(
      valueToText(filterValueFor(cycles.type, 'c1'), cycles.type, options),
    ).toBe('2026-05')
  })

  it('still reads a list of options', () => {
    expect(
      valueToText(
        filterValueFor(cycles.type, ['c1', 'c2']),
        cycles.type,
        options,
      ),
    ).toBe('2026-05, 2026-06')
  })

  it('leaves a column that holds one value alone', () => {
    expect(filterValueFor('select', 'c1')).toBe('c1')
  })

  it('filters by that same single option', () => {
    const list = [
      row('x', 'X', { cycles: ['c1'] }),
      row('y', 'Y', { cycles: ['c2'] }),
    ]

    expect(
      applyFilters(
        list,
        [{ propertyId: 'cycles', operator: 'contains', value: 'c1' }],
        [cycles],
      ).map((item) => item.id),
    ).toEqual(['x'])
  })
})

import { describe, expect, it } from 'vitest'

import { serializeOptions } from './values'
import {
  TITLE_PROPERTY_ID,
  type DatabaseRow,
  type ViewConfig,
  applyFilters,
  applySorts,
  boardPropertyOf,
  emptyViewConfig,
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
    { id: 'todo', name: 'A fazer', color: 'gray' },
    { id: 'done', name: 'Feito', color: 'success' },
  ]),
}

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

describe('configuração de visualização', () => {
  it('devolve configuração vazia quando o json está quebrado', () => {
    expect(parseViewConfig('{')).toEqual(emptyViewConfig)
    expect(parseViewConfig('[]')).toEqual(emptyViewConfig)
    expect(parseViewConfig(null)).toEqual(emptyViewConfig)
  })

  it('descarta filtro e ordenação com forma inválida', () => {
    const parsed = parseViewConfig(
      JSON.stringify({
        filters: [
          { propertyId: 'status', operator: 'is', value: 'todo' },
          { propertyId: 'status', operator: 'invento' },
          { operator: 'is' },
        ],
        sorts: [
          { propertyId: 'points', direction: 'desc' },
          { propertyId: 'points', direction: 'lado' },
        ],
        hiddenPropertyIds: ['due', 7],
      }),
    )

    expect(parsed.filters).toHaveLength(1)
    expect(parsed.sorts).toEqual([{ propertyId: 'points', direction: 'desc' }])
    expect(parsed.hiddenPropertyIds).toEqual(['due'])
  })

  it('faz ida e volta da configuração', () => {
    const config: ViewConfig = {
      groupByPropertyId: 'status',
      filters: [{ propertyId: 'points', operator: 'greaterThan', value: 2 }],
      sorts: [{ propertyId: TITLE_PROPERTY_ID, direction: 'asc' }],
      hiddenPropertyIds: ['due'],
    }

    expect(parseViewConfig(serializeViewConfig(config))).toEqual(config)
  })

  it('oferece só os operadores que fazem sentido para cada tipo', () => {
    expect(operatorsFor('checkbox')).toEqual(['is'])
    expect(operatorsFor('date')).toContain('before')
    expect(operatorsFor('number')).toContain('greaterThan')
    expect(operatorsFor('select')).not.toContain('contains')
  })
})

describe('filtros', () => {
  it('filtra por seleção, número, data e caixa', () => {
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

  it('filtra pelo título da linha', () => {
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

  it('trata vazio e não vazio', () => {
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

  it('ignora filtro de propriedade que foi excluída', () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: 'sumiu', operator: 'is', value: 'x' }],
        properties,
      ),
    ).toHaveLength(3)
  })

  it('exige que todos os filtros passem', () => {
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

describe('ordenação', () => {
  it('ordena por número e joga o vazio para o fim nos dois sentidos', () => {
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

  it('ordena por título respeitando acento', () => {
    const acentuadas = [
      row('1', 'Zebra', {}),
      row('2', 'Água', {}),
      row('3', 'Banana', {}),
    ]

    expect(
      applySorts(
        acentuadas,
        [{ propertyId: TITLE_PROPERTY_ID, direction: 'asc' }],
        properties,
      ).map((item) => item.title),
    ).toEqual(['Água', 'Banana', 'Zebra'])
  })

  it('ordena seleção pela ordem das opções, não pelo texto', () => {
    expect(
      applySorts(
        rows,
        [{ propertyId: 'status', direction: 'asc' }],
        properties,
      ).map((item) => item.id),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('quadro', () => {
  it('agrupa por seleção e guarda uma coluna para quem não tem valor', () => {
    const groups = groupRows(rows, status, 'Sem valor')

    expect(groups.map((group) => group.name)).toEqual([
      'A fazer',
      'Feito',
      'Sem valor',
    ])
    expect(groups[0].rows.map((item) => item.id)).toEqual(['a'])
    expect(groups[2].rows.map((item) => item.id)).toEqual(['c'])
  })

  it('cai para uma coluna só quando não há propriedade de agrupamento', () => {
    const groups = groupRows(rows, null, 'Sem valor')

    expect(groups).toHaveLength(1)
    expect(groups[0].rows).toHaveLength(3)
  })

  it('escolhe a primeira seleção quando a configurada não serve', () => {
    expect(
      boardPropertyOf(properties, {
        ...emptyViewConfig,
        groupByPropertyId: 'points',
      })?.id,
    ).toBe('status')

    expect(boardPropertyOf([points], emptyViewConfig)).toBeNull()
  })
})

describe('propriedades visíveis', () => {
  it('tira as ocultas da visualização', () => {
    expect(
      visibleProperties(properties, {
        ...emptyViewConfig,
        hiddenPropertyIds: ['due', 'done'],
      }).map((item) => item.id),
    ).toEqual(['status', 'points'])
  })
})

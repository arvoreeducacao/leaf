import { describe, expect, it } from 'vitest'

import { personOptions } from './people'
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

const owners = { id: 'owners', type: 'person' as const, options: null }

const phase = {
  id: 'phase',
  type: 'status' as const,
  options: serializeOptions([
    { id: 'f', name: 'Feito', color: 'success', group: 'done' },
    { id: 'p', name: 'Pendente', color: 'gray', group: 'todo' },
    { id: 'a', name: 'Andando', color: 'blue', group: 'doing' },
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

describe('quadro por pessoa', () => {
  const shared = [
    row('a', 'Alfa', { owners: ['u1', 'u2'] }),
    row('b', 'Beta', { owners: ['u2'] }),
    row('c', 'Gama', { owners: [] }),
  ]

  it('põe a linha na coluna de cada pessoa que está nela', () => {
    const groups = groupRows(shared, owners, 'Sem responsável', people)

    expect(groups.map((group) => group.name)).toEqual([
      'Rafael',
      'Raposo',
      'Sem responsável',
    ])
    expect(groups[0].rows.map((item) => item.id)).toEqual(['a'])
    expect(groups[1].rows.map((item) => item.id)).toEqual(['a', 'b'])
    expect(groups[2].rows.map((item) => item.id)).toEqual(['c'])
  })

  it('manda pra coluna vazia quem aponta pra gente que saiu da organização', () => {
    const groups = groupRows(
      [row('x', 'Órfã', { owners: ['sumiu'] })],
      owners,
      'Sem responsável',
      people,
    )

    expect(groups[groups.length - 1].rows.map((item) => item.id)).toEqual(['x'])
  })

  it('aceita pessoa como propriedade de agrupamento', () => {
    expect(
      boardPropertyOf([points, owners], {
        ...emptyViewConfig,
        groupByPropertyId: 'owners',
      })?.id,
    ).toBe('owners')
  })

  it('ordena as colunas de status por a fazer, fazendo e feito', () => {
    const groups = groupRows(
      [row('a', 'Alfa', { phase: 'f' }), row('b', 'Beta', { phase: 'p' })],
      phase,
      'Sem valor',
    )

    expect(groups.map((group) => group.name)).toEqual([
      'Pendente',
      'Andando',
      'Feito',
      'Sem valor',
    ])
  })
})

describe('filtro sou eu', () => {
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

  it('deixa passar só o que é de quem está olhando', () => {
    expect(
      applyFilters(mine, [filter], [owners], 'u1').map((item) => item.id),
    ).toEqual(['a'])

    expect(
      applyFilters(mine, [filter], [owners], 'u2').map((item) => item.id),
    ).toEqual(['a', 'b'])
  })

  it('não deixa passar nada quando ninguém está logado', () => {
    expect(applyFilters(mine, [filter], [owners], null)).toEqual([])
  })

  it('oferece sou eu como operador de pessoa e não de seleção', () => {
    expect(operatorsFor('person')).toContain('isMe')
    expect(operatorsFor('select')).not.toContain('isMe')
  })
})

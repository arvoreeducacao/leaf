import { describe, expect, it } from 'vitest'

import { inferColumnType, inferDatabase } from './csv-import'

describe('inferência de tipo de coluna do csv', () => {
  it('lê caixa de seleção do Notion em português e em inglês', () => {
    expect(inferColumnType(['Yes', 'No', 'Yes'])).toBe('checkbox')
    expect(inferColumnType(['Sim', 'Não'])).toBe('checkbox')
  })

  it('lê número antes de tentar data', () => {
    expect(inferColumnType(['12', '7', '3'])).toBe('number')
    expect(inferColumnType(['5', '6'])).toBe('number')
  })

  it('lê data só quando o valor tem dígito', () => {
    expect(inferColumnType(['2026-03-04', '10/02/2026'])).toBe('date')
    expect(inferColumnType(['May', 'June'])).not.toBe('date')
  })

  it('lê link', () => {
    expect(
      inferColumnType(['https://arvore.com.br', 'http://leaf.arvore.com.br']),
    ).toBe('url')
  })

  it('lê multisseleção quando os rótulos são curtos e se repetem', () => {
    expect(
      inferColumnType([
        'Leitura, Escrita',
        'Leitura',
        'Escrita, Fluência',
        'Leitura, Fluência',
      ]),
    ).toBe('multiSelect')
  })

  it('não confunde texto com vírgula com multisseleção', () => {
    expect(
      inferColumnType([
        'Leitora assídua, gosta de biografias',
        'Prefere quadrinhos',
      ]),
    ).toBe('text')
  })

  it('lê seleção quando os valores se repetem', () => {
    expect(
      inferColumnType([
        'A fazer',
        'Feito',
        'A fazer',
        'Em andamento',
        'Feito',
        'A fazer',
      ]),
    ).toBe('select')
  })

  it('não transforma coluna de nomes únicos em seleção', () => {
    expect(
      inferColumnType(['Ana', 'Bruno', 'Carla', 'Davi', 'Eva', 'Fábio']),
    ).toBe('text')
  })

  it('cai para texto quando a coluna está vazia', () => {
    expect(inferColumnType(['', '  '])).toBe('text')
  })
})

describe('conversão da database csv em base de dados', () => {
  const table = [
    ['Nome', 'Livros', 'Status', 'Temas', 'Lido'],
    ['Ana', '12', 'Feito', 'Leitura, Escrita', 'Yes'],
    ['Bruno', '7', 'A fazer', 'Leitura', 'No'],
    ['Carla', '', 'Feito', '', 'Yes'],
  ]

  it('usa a primeira coluna como título da linha', () => {
    const inferred = inferDatabase(table, 'Coluna')

    expect(inferred?.rows.map((row) => row.title)).toEqual([
      'Ana',
      'Bruno',
      'Carla',
    ])
  })

  it('cria uma propriedade por coluna a partir da segunda', () => {
    const inferred = inferDatabase(table, 'Coluna')

    expect(
      inferred?.properties.map((property) => [property.name, property.type]),
    ).toEqual([
      ['Livros', 'number'],
      ['Status', 'select'],
      ['Temas', 'multiSelect'],
      ['Lido', 'checkbox'],
    ])
  })

  it('cria as opções na ordem em que aparecem', () => {
    const inferred = inferDatabase(table, 'Coluna')
    const status = inferred?.properties[1]
    const temas = inferred?.properties[2]

    expect(status?.options.map((option) => option.name)).toEqual([
      'Feito',
      'A fazer',
    ])
    expect(temas?.options.map((option) => option.name)).toEqual([
      'Leitura',
      'Escrita',
    ])
  })

  it('converte cada célula no valor do tipo da coluna', () => {
    const inferred = inferDatabase(table, 'Coluna')
    const temas = inferred?.properties[2]
    const ana = inferred?.rows[0]

    expect(ana?.values[0]).toBe(12)
    expect(ana?.values[3]).toBe(true)
    expect(ana?.values[2]).toEqual(temas?.options.map((option) => option.id))
  })

  it('deixa a célula vazia sem valor em vez de inventar um', () => {
    const inferred = inferDatabase(table, 'Coluna')

    expect(inferred?.rows[2].values[0]).toBeUndefined()
    expect(inferred?.rows[2].values[2]).toBeUndefined()
  })

  it('nomeia coluna sem cabeçalho', () => {
    const inferred = inferDatabase(
      [
        ['Nome', ''],
        ['Ana', 'x'],
      ],
      'Coluna',
    )

    expect(inferred?.properties[0].name).toBe('Coluna 1')
  })

  it('devolve nulo quando não há cabeçalho', () => {
    expect(inferDatabase([], 'Coluna')).toBeNull()
  })
})

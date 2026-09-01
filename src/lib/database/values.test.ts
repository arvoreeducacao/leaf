import { describe, expect, it } from 'vitest'

import {
  type SelectOption,
  coerceDate,
  linkHrefFor,
  colorForIndex,
  emptyValueFor,
  formatNumber,
  groupOf,
  isEmptyValue,
  normalizeValue,
  parseOptions,
  parseValues,
  serializeOptions,
  serializeValues,
  sortByStatusGroup,
  valueOf,
  valueToText,
} from './values'

const options: Array<SelectOption> = [
  { id: 'op1', name: 'A fazer', color: 'gray' },
  { id: 'op2', name: 'Feito', color: 'success' },
]

describe('valores de propriedade', () => {
  it('converte texto em número aceitando vírgula decimal e separador de milhar', () => {
    expect(normalizeValue('number', '1.234,56')).toBe(1234.56)
    expect(normalizeValue('number', '1,234.56')).toBe(1234.56)
    expect(normalizeValue('number', 'R$ 42')).toBe(42)
    expect(normalizeValue('number', 'sem número')).toBeNull()
  })

  it('normaliza data em ISO a partir dos formatos que o Notion exporta', () => {
    expect(coerceDate('2026-03-04')).toBe('2026-03-04')
    expect(coerceDate('04/03/2026')).toBe('2026-03-04')
    expect(coerceDate('March 4, 2026')).toBe('2026-03-04')
    expect(coerceDate('nada')).toBeNull()
  })

  it('lê caixa de seleção nas formas que aparecem em planilha', () => {
    expect(normalizeValue('checkbox', 'Yes')).toBe(true)
    expect(normalizeValue('checkbox', 'sim')).toBe(true)
    expect(normalizeValue('checkbox', 'No')).toBe(false)
    expect(normalizeValue('checkbox', '')).toBe(false)
  })

  it('zera url com protocolo perigoso e mantém a segura', () => {
    expect(normalizeValue('url', 'javascript:alert(1)')).toBe('')
    expect(normalizeValue('url', 'JaVaScRiPt:alert(1)')).toBe('')
    expect(normalizeValue('url', 'data:text/html;base64,PHNjcmlwdD4=')).toBe('')
    expect(normalizeValue('url', '  java\u0000script:alert(1)  ')).toBe('')
    expect(normalizeValue('url', 'https://arvore.com.br')).toBe(
      'https://arvore.com.br',
    )
    expect(normalizeValue('url', 'mailto:oi@arvore.com.br')).toBe(
      'mailto:oi@arvore.com.br',
    )
    expect(normalizeValue('url', '/doc/abc')).toBe('/doc/abc')
  })

  it('só devolve href para link que o navegador pode abrir com segurança', () => {
    expect(linkHrefFor('https://arvore.com.br')).toBe('https://arvore.com.br')
    expect(linkHrefFor('/doc/abc')).toBe('/doc/abc')
    expect(linkHrefFor('javascript:alert(1)')).toBeNull()
    expect(linkHrefFor('data:text/html,<script>')).toBeNull()
    expect(linkHrefFor('')).toBeNull()
    expect(linkHrefFor(null)).toBeNull()
    expect(linkHrefFor(42)).toBeNull()
  })

  it('descarta opção que não existe mais na propriedade', () => {
    expect(normalizeValue('select', 'op1', options)).toBe('op1')
    expect(normalizeValue('select', 'sumiu', options)).toBeNull()
    expect(normalizeValue('multiSelect', ['op2', 'sumiu'], options)).toEqual([
      'op2',
    ])
  })

  it('reduz seleção múltipla a uma opção quando o tipo vira seleção', () => {
    expect(normalizeValue('select', ['op2', 'op1'], options)).toBe('op2')
  })

  it('devolve o valor vazio de cada tipo quando a linha nunca foi preenchida', () => {
    expect(emptyValueFor('checkbox')).toBe(false)
    expect(emptyValueFor('multiSelect')).toEqual([])
    expect(emptyValueFor('text')).toBe('')
    expect(emptyValueFor('number')).toBeNull()

    expect(valueOf({}, { id: 'p1', type: 'text' })).toBe('')
    expect(valueOf({ p1: 7 }, { id: 'p1', type: 'number' })).toBe(7)
  })

  it('reconhece valor vazio por tipo', () => {
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('  ')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue(false)).toBe(true)
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue('a')).toBe(false)
  })

  it('sobrevive a options e values corrompidos no banco', () => {
    expect(parseOptions('não é json')).toEqual([])
    expect(parseOptions('{"a":1}')).toEqual([])
    expect(parseOptions('[{"id":"x"}]')).toEqual([])
    expect(parseValues('[1,2]')).toEqual({})
    expect(parseValues(null)).toEqual({})
  })

  it('faz ida e volta de opções e valores', () => {
    expect(parseOptions(serializeOptions(options))).toEqual(options)
    expect(parseValues(serializeValues({ p1: 'oi', p2: null }))).toEqual({
      p1: 'oi',
      p2: null,
    })
  })

  it('escreve o texto de cada tipo para exportação', () => {
    expect(valueToText('op1', 'select', options)).toBe('A fazer')
    expect(valueToText(['op1', 'op2'], 'multiSelect', options)).toBe(
      'A fazer, Feito',
    )
    expect(valueToText(true, 'checkbox', [])).toBe('✓')
    expect(valueToText(false, 'checkbox', [])).toBe('')
    expect(valueToText('2026-03-04', 'date', [], 'en-US')).toContain('2026')
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
  })

  it('gira as cores das opções sem estourar a paleta', () => {
    expect(colorForIndex(0)).toBe(colorForIndex(9))
    expect(colorForIndex(100)).toBeTruthy()
  })
})

describe('pessoa', () => {
  const roster = [
    { id: 'u1', name: 'Rafael', color: 'gray' as const },
    { id: 'u2', name: 'Raposo', color: 'blue' as const },
  ]

  it('nasce vazia', () => {
    expect(emptyValueFor('person')).toEqual([])
  })

  it('guarda vários ids', () => {
    expect(normalizeValue('person', ['u1', 'u2'], roster)).toEqual(['u1', 'u2'])
  })

  it('descarta quem não está na lista quando a lista foi dada', () => {
    expect(normalizeValue('person', ['u1', 'estranho'], roster)).toEqual(['u1'])
  })

  it('deixa passar quando não há lista, porque quem valida é o servidor', () => {
    expect(normalizeValue('person', ['u1', 'u9'])).toEqual(['u1', 'u9'])
  })

  it('escreve os nomes separados por vírgula', () => {
    expect(valueToText(['u1', 'u2'], 'person', roster)).toBe('Rafael, Raposo')
  })

  it('conta como vazia quando ninguém está nela', () => {
    expect(isEmptyValue(normalizeValue('person', [], roster))).toBe(true)
  })
})

describe('status', () => {
  const options = [
    { id: 'p', name: 'Pendente', color: 'gray' as const, group: 'todo' as const },
    { id: 'f', name: 'Feito', color: 'success' as const, group: 'done' as const },
    { id: 'a', name: 'Andando', color: 'blue' as const, group: 'doing' as const },
  ]

  it('guarda um valor só, como a seleção', () => {
    expect(normalizeValue('status', ['f', 'p'], options)).toBe('f')
  })

  it('sobrevive à ida e volta pelo json, com o grupo', () => {
    expect(parseOptions(serializeOptions(options))).toEqual(options)
  })

  it('trata opção sem grupo como a fazer', () => {
    expect(groupOf({ id: 'x', name: 'Velha', color: 'gray' })).toBe('todo')
  })

  it('recusa grupo que não existe', () => {
    expect(
      parseOptions(
        JSON.stringify([{ id: 'x', name: 'X', color: 'gray', group: 'oops' }]),
      ),
    ).toEqual([])
  })

  it('ordena a fazer, fazendo e feito', () => {
    expect(sortByStatusGroup(options).map((option) => option.id)).toEqual([
      'p',
      'a',
      'f',
    ])
  })
})

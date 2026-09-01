import { describe, expect, it } from 'vitest'

import { arrangeMenuItems } from './slash-menu-items'

type Item = { title: string; group: string }

const defaults: Array<Item> = [
  { title: 'Título 1', group: 'Títulos' },
  { title: 'Citação', group: 'Blocos básicos' },
  { title: 'Lista', group: 'Blocos básicos' },
  { title: 'Tabela', group: 'Avançado' },
  { title: 'Imagem', group: 'Avançado' },
]

const callout: Item = { title: 'Destaque', group: 'Blocos básicos' }
const database: Item = { title: 'Base de dados', group: 'Avançado' }
const importItem: Item = { title: 'Importar .md', group: 'Importar' }

function groupsOf(items: ReadonlyArray<Item>) {
  return items.map((item) => item.group)
}

function runsOf(items: ReadonlyArray<Item>) {
  return groupsOf(items).filter((group, index, list) => group !== list[index - 1])
}

describe('ordem do menu de barra', () => {
  it('insere cada item logo depois do irmão de grupo', () => {
    const items = arrangeMenuItems(
      defaults,
      [
        { after: 'Citação', item: callout },
        { after: 'Tabela', item: database },
      ],
      [importItem],
    )

    expect(items.map((item) => item.title)).toEqual([
      'Título 1',
      'Citação',
      'Destaque',
      'Lista',
      'Tabela',
      'Base de dados',
      'Imagem',
      'Importar .md',
    ])
  })

  it('mantém cada grupo num bloco só, senão o menu duplica a seção', () => {
    const items = arrangeMenuItems(
      defaults,
      [
        { after: 'Citação', item: callout },
        { after: 'Tabela', item: database },
      ],
      [importItem],
    )

    const runs = runsOf(items)

    expect(runs).toEqual(new Array(...new Set(runs)))
    expect(runs).toEqual(['Títulos', 'Blocos básicos', 'Avançado', 'Importar'])
  })

  it('joga no fim o item cujo irmão não existe mais no menu', () => {
    const items = arrangeMenuItems(
      defaults,
      [{ after: 'Bloco que sumiu', item: database }],
      [],
    )

    expect(items.at(-1)?.title).toBe('Base de dados')
  })

  it('não mexe no menu quando não há nada para inserir', () => {
    expect(arrangeMenuItems(defaults, [], [])).toEqual(defaults)
  })
})

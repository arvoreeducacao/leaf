import { describe, expect, it } from 'vitest'

import {
  normalizeSearchTerm,
  searchDocumentList,
  searchDocumentTree,
} from '@/lib/document-search'
import type { DocumentNode, DocumentSummary } from '@/lib/documents'

function node(
  id: string,
  title: string,
  children: Array<DocumentNode> = [],
): DocumentNode {
  return {
    id,
    title,
    updatedAt: new Date(0),
    deletedAt: null,
    parentId: null,
    shared: false,
    depth: 0,
    children,
  }
}

function summary(id: string, title: string): DocumentSummary {
  return {
    id,
    title,
    updatedAt: new Date(0),
    deletedAt: null,
    parentId: null,
    shared: true,
  }
}

describe('normalizeSearchTerm', () => {
  it('remove acentos e caixa', () => {
    expect(normalizeSearchTerm('  Ação Educação ')).toBe('acao educacao')
  })
})

describe('searchDocumentTree', () => {
  const tree = [
    node('a', 'Planejamento', [
      node('b', 'Aulas de leitura', [node('c', 'Semana 1')]),
    ]),
    node('d', 'Relatório de férias'),
  ]

  it('devolve nada quando o termo é vazio', () => {
    expect(searchDocumentTree(tree, '   ')).toEqual([])
  })

  it('acha em qualquer nível e devolve o caminho dos ancestrais', () => {
    const found = searchDocumentTree(tree, 'semana')

    expect(found).toEqual([
      {
        id: 'c',
        title: 'Semana 1',
        path: 'Planejamento / Aulas de leitura',
        shared: false,
      },
    ])
  })

  it('ignora acento e caixa', () => {
    const found = searchDocumentTree(tree, 'RELATORIO')

    expect(found.map((item) => item.id)).toEqual(['d'])
  })

  it('ordena os resultados pelo título', () => {
    const found = searchDocumentTree(tree, 'a')

    expect(found.map((item) => item.title)).toEqual([
      'Aulas de leitura',
      'Planejamento',
      'Relatório de férias',
      'Semana 1',
    ])
  })
})

describe('searchDocumentList', () => {
  it('marca os resultados como compartilhados', () => {
    const found = searchDocumentList(
      [summary('x', 'Plano da escola'), summary('y', 'Outra coisa')],
      'plano',
    )

    expect(found).toEqual([
      { id: 'x', title: 'Plano da escola', path: '', shared: true },
    ])
  })

  it('devolve nada quando o termo é vazio', () => {
    expect(searchDocumentList([summary('x', 'Plano')], '')).toEqual([])
  })
})

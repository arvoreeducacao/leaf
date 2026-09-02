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
    kind: 'page',
    icon: null,
    shared: false,
    owned: true,
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
    kind: 'page',
    icon: null,
    shared: true,
    owned: false,
  }
}

describe('normalizeSearchTerm', () => {
  it('strips accents and case', () => {
    expect(normalizeSearchTerm('  Ação Educação ')).toBe('acao educacao')
  })
})

describe('searchDocumentTree', () => {
  const tree = [
    node('a', 'Planning', [
      node('b', 'Reading classes', [node('c', 'Class week')]),
    ]),
    node('d', 'Relatório de férias'),
  ]

  it('returns nothing when the term is empty', () => {
    expect(searchDocumentTree(tree, '   ')).toEqual([])
  })

  it('finds at any level and returns the ancestor path', () => {
    const found = searchDocumentTree(tree, 'week')

    expect(found).toEqual([
      {
        id: 'c',
        title: 'Class week',
        path: 'Planning / Reading classes',
        shared: false,
      },
    ])
  })

  it('ignores accent and case', () => {
    const found = searchDocumentTree(tree, 'RELATORIO')

    expect(found.map((item) => item.id)).toEqual(['d'])
  })

  it('sorts the results by title', () => {
    const found = searchDocumentTree(tree, 'a')

    expect(found.map((item) => item.title)).toEqual([
      'Class week',
      'Planning',
      'Reading classes',
      'Relatório de férias',
    ])
  })
})

describe('searchDocumentList', () => {
  it('marks the results as shared', () => {
    const found = searchDocumentList(
      [summary('x', 'School plan'), summary('y', 'Something else')],
      'plan',
    )

    expect(found).toEqual([
      { id: 'x', title: 'School plan', path: '', shared: true },
    ])
  })

  it('returns nothing when the term is empty', () => {
    expect(searchDocumentList([summary('x', 'Plan')], '')).toEqual([])
  })
})

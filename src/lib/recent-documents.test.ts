import { describe, expect, it } from 'vitest'

import type { DocumentSummary } from '@/lib/documents'
import { promoteVisitedDocuments, rememberVisit } from '@/lib/recent-documents'

function summary(id: string, owned = true): DocumentSummary {
  return {
    id,
    title: id.toUpperCase(),
    icon: null,
    kind: 'page',
    parentId: null,
    updatedAt: new Date(0),
    deletedAt: null,
    owned,
    shared: !owned,
  }
}

function node(id: string, title = id.toUpperCase()) {
  return { id, title, icon: null, kind: 'page' as const }
}

describe('promoteVisitedDocuments', () => {
  it('keeps the server order when nothing was visited in the session', () => {
    const documents = [summary('a'), summary('b')]

    expect(promoteVisitedDocuments(documents, [])).toEqual(documents)
  })

  it('puts documents visited in the session on top, most recent first', () => {
    const result = promoteVisitedDocuments(
      [summary('a'), summary('b'), summary('c')],
      [node('c'), node('b')],
    )

    expect(result.map((document) => document.id)).toEqual(['c', 'b', 'a'])
  })

  it('keeps what the server knows about a promoted document', () => {
    const [promoted] = promoteVisitedDocuments(
      [summary('a', false)],
      [node('a', 'Renamed')],
    )

    expect(promoted).toMatchObject({ id: 'a', owned: false, title: 'Renamed' })
  })

  it('adds a document the server list does not have yet', () => {
    const result = promoteVisitedDocuments([summary('a')], [node('new')])

    expect(result.map((document) => document.id)).toEqual(['new', 'a'])
    expect(result[0]).toMatchObject({ owned: false, deletedAt: null })
  })

  it('never grows past the limit', () => {
    const result = promoteVisitedDocuments(
      [summary('a'), summary('b')],
      [node('c')],
      2,
    )

    expect(result.map((document) => document.id)).toEqual(['c', 'a'])
  })
})

describe('rememberVisit', () => {
  it('moves a revisited document to the front without duplicating it', () => {
    expect(
      rememberVisit([node('b'), node('a')], node('a')).map((entry) => entry.id),
    ).toEqual(['a', 'b'])
  })
})

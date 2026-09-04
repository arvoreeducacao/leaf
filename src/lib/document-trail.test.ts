import { describe, expect, it } from 'vitest'

import type { TrailNode } from '@/lib/document-trail'
import { graftActiveTrail, reachableTrail } from '@/lib/document-trail'
import type { DocumentNode } from '@/lib/documents'

function node(
  id: string,
  children: Array<DocumentNode> = [],
  depth = 0,
): DocumentNode {
  return {
    children,
    deletedAt: null,
    depth,
    icon: null,
    id,
    kind: 'page',
    owned: true,
    parentId: null,
    shared: false,
    title: id,
    updatedAt: new Date('2026-09-04T12:00:00Z'),
  }
}

function crumb(id: string, kind: TrailNode['kind'] = 'page'): TrailNode {
  return { icon: null, id, kind, title: id }
}

function idsOf(nodes: Array<DocumentNode>): Array<string> {
  return nodes.flatMap((item) => [item.id, ...idsOf(item.children)])
}

describe('reachableTrail', () => {
  it('keeps the whole trail when nothing in it is a database row', () => {
    const trail = [crumb('root'), crumb('base', 'database'), crumb('page')]

    expect(reachableTrail(trail).map((item) => item.id)).toEqual([
      'root',
      'base',
      'page',
    ])
  })

  it('stops at the row, because the sidebar tree never lists rows', () => {
    const trail = [crumb('base', 'database'), crumb('linha', 'row')]

    expect(reachableTrail(trail).map((item) => item.id)).toEqual(['base'])
  })

  it('stops at the row even when a page hangs below it', () => {
    const trail = [
      crumb('base', 'database'),
      crumb('linha', 'row'),
      crumb('anotacao'),
    ]

    expect(reachableTrail(trail).map((item) => item.id)).toEqual(['base'])
  })
})

describe('graftActiveTrail', () => {
  it('marks the open page and leaves the tree alone when it is already there', () => {
    const roots = [node('root', [node('child', [], 1)])]
    const grafted = graftActiveTrail(roots, [crumb('root'), crumb('child')])

    expect(grafted.markedId).toBe('child')
    expect(grafted.nodes).toBe(roots)
  })

  it('marks the database that holds the open row, not the row', () => {
    const roots = [node('root', [node('base', [], 1)])]
    const grafted = graftActiveTrail(roots, [
      crumb('root'),
      crumb('base', 'database'),
      crumb('linha', 'row'),
    ])

    expect(grafted.markedId).toBe('base')
    expect(idsOf(grafted.nodes)).toEqual(['root', 'base'])
  })

  it('grafts the branch when the page sits outside the loaded roots', () => {
    const roots = [node('outro')]
    const grafted = graftActiveTrail(roots, [
      crumb('root'),
      crumb('meio'),
      crumb('page'),
    ])

    expect(grafted.markedId).toBe('page')
    expect(idsOf(grafted.nodes)).toEqual(['root', 'meio', 'page', 'outro'])
    expect(idsOf(roots)).toEqual(['outro'])
  })

  it('hangs the missing part under the ancestor the tree already has', () => {
    const roots = [node('root', [node('meio', [], 1)])]
    const grafted = graftActiveTrail(roots, [
      crumb('root'),
      crumb('meio'),
      crumb('page'),
    ])

    expect(grafted.markedId).toBe('page')
    expect(idsOf(grafted.nodes)).toEqual(['root', 'meio', 'page'])
    expect(grafted.nodes[0].children[0].children[0].depth).toBe(2)
  })

  it('marks nothing when the trail has no reachable node', () => {
    const roots = [node('root')]
    const grafted = graftActiveTrail(roots, [crumb('linha', 'row')])

    expect(grafted.markedId).toBeNull()
    expect(grafted.nodes).toBe(roots)
  })
})

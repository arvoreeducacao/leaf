import type { DocumentNode, DocumentSummary } from '@/lib/documents'

export type TrailNode = Pick<DocumentSummary, 'id' | 'title' | 'icon' | 'kind'>

export function reachableTrail(
  trail: ReadonlyArray<TrailNode>,
): Array<TrailNode> {
  const reachable: Array<TrailNode> = []

  for (const node of trail) {
    if (node.kind === 'row') {
      break
    }

    reachable.push(node)
  }

  return reachable
}

function cloneNodes(nodes: ReadonlyArray<DocumentNode>): Array<DocumentNode> {
  return nodes.map((node) => ({ ...node, children: cloneNodes(node.children) }))
}

function indexNodes(nodes: ReadonlyArray<DocumentNode>) {
  const index = new Map<string, DocumentNode>()

  function walk(list: ReadonlyArray<DocumentNode>) {
    for (const node of list) {
      index.set(node.id, node)
      walk(node.children)
    }
  }

  walk(nodes)

  return index
}

export type GraftedTree = Readonly<{
  nodes: Array<DocumentNode>
  markedId: string | null
}>

export function graftActiveTrail(
  roots: Array<DocumentNode>,
  trail: ReadonlyArray<TrailNode>,
): GraftedTree {
  const path = reachableTrail(trail)

  if (path.length === 0) {
    return { markedId: null, nodes: roots }
  }

  const markedId = path[path.length - 1].id

  if (indexNodes(roots).has(markedId)) {
    return { markedId, nodes: roots }
  }

  const nodes = cloneNodes(roots)
  const index = indexNodes(nodes)
  let parent: DocumentNode | null = null

  for (const step of path) {
    const existing = index.get(step.id)

    if (existing) {
      parent = existing
      continue
    }

    const grafted: DocumentNode = {
      children: [],
      deletedAt: null,
      depth: parent ? parent.depth + 1 : 0,
      icon: step.icon,
      id: step.id,
      kind: step.kind,
      owned: false,
      parentId: parent?.id ?? null,
      shared: false,
      title: step.title,
      updatedAt: new Date(0),
    }

    if (parent) {
      parent.children.unshift(grafted)
    } else {
      nodes.unshift(grafted)
    }

    index.set(grafted.id, grafted)
    parent = grafted
  }

  return { markedId, nodes }
}

import type {
  GraphEdge,
  GraphNode,
  OrganizationGraph,
} from '@/lib/document-link-graph'

export const lightPalette = ['#2783de', '#d9730d', '#6940a5', '#c19401', '#dc3f3f']
export const darkPalette = ['#2783de', '#d9730d', '#9a7bc6', '#9d7801', '#eb5757']
export const otherColor = { light: '#9b9a97', dark: '#6f6f6f' }

export const otherGroup = '__others__'

export type GraphFilters = Readonly<{
  hiddenGroups: ReadonlySet<string>
  showSubpages: boolean
  showLoose: boolean
  focusId: string | null
  depth: 1 | 2 | null
}>

export type VisibleGraph = Readonly<{
  nodes: Array<GraphNode>
  edges: Array<GraphEdge>
  degree: Map<string, number>
  loose: number
}>

export type GroupLegend = Readonly<{ id: string; name: string; index: number }>

export function groupLegend(graph: OrganizationGraph): Array<GroupLegend> {
  const counts = new Map<string, number>()

  for (const node of graph.nodes) {
    if (node.teamspaceId) {
      counts.set(node.teamspaceId, (counts.get(node.teamspaceId) ?? 0) + 1)
    }
  }

  return graph.teamspaces
    .filter((teamspace) => counts.has(teamspace.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, lightPalette.length)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((teamspace, index) => ({ ...teamspace, index }))
}

export function groupOf(
  node: GraphNode,
  legend: ReadonlyArray<GroupLegend>,
): string {
  return node.teamspaceId && legend.some((entry) => entry.id === node.teamspaceId)
    ? node.teamspaceId
    : otherGroup
}

function neighborhood(
  start: string,
  edges: ReadonlyArray<GraphEdge>,
  depth: number,
): Set<string> {
  const adjacency = new Map<string, Array<string>>()

  const connect = (from: string, to: string) => {
    const list = adjacency.get(from)

    if (list) {
      list.push(to)
    } else {
      adjacency.set(from, [to])
    }
  }

  for (const edge of edges) {
    connect(edge.source, edge.target)
    connect(edge.target, edge.source)
  }

  const reached = new Set([start])
  let frontier = [start]

  for (let hop = 0; hop < depth; hop++) {
    const next: Array<string> = []

    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!reached.has(neighbor)) {
          reached.add(neighbor)
          next.push(neighbor)
        }
      }
    }

    frontier = next
  }

  return reached
}

export function visibleGraph(
  graph: OrganizationGraph,
  legend: ReadonlyArray<GroupLegend>,
  filters: GraphFilters,
): VisibleGraph {
  const inGroup = graph.nodes.filter(
    (node) => !filters.hiddenGroups.has(groupOf(node, legend)),
  )
  const ids = new Set(inGroup.map((node) => node.id))

  let edges = graph.edges.filter(
    (edge) =>
      ids.has(edge.source) &&
      ids.has(edge.target) &&
      (filters.showSubpages || edge.relation === 'citation'),
  )

  const degree = new Map<string, number>()

  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  const loose = inGroup.filter((node) => !degree.has(node.id)).length
  let nodes = inGroup.filter((node) => filters.showLoose || degree.has(node.id))

  if (filters.focusId && filters.depth && ids.has(filters.focusId)) {
    const kept = neighborhood(filters.focusId, edges, filters.depth)

    nodes = inGroup.filter((node) => kept.has(node.id))
    edges = edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target))
  }

  return { nodes, edges, degree, loose }
}

export function linkCounts(graph: OrganizationGraph, id: string) {
  let incoming = 0
  let outgoing = 0

  for (const edge of graph.edges) {
    if (edge.target === id) {
      incoming += 1
    }

    if (edge.source === id) {
      outgoing += 1
    }
  }

  return { incoming, outgoing }
}

export function findByTitle(
  nodes: ReadonlyArray<GraphNode>,
  term: string,
): GraphNode | null {
  const wanted = term
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  if (wanted.length === 0) {
    return null
  }

  const plain = (value: string) =>
    value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '')

  return (
    nodes.find((node) => plain(node.title) === wanted) ??
    nodes.find((node) => plain(node.title).startsWith(wanted)) ??
    nodes.find((node) => plain(node.title).includes(wanted)) ??
    null
  )
}

import type { DocumentNode, DocumentSummary } from '@/lib/documents'

export type DocumentMatch = Readonly<{
  id: string
  title: string
  path: string
  shared: boolean
}>

export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function matches(title: string, term: string) {
  return normalizeSearchTerm(title).includes(term)
}

function sortMatches(list: Array<DocumentMatch>) {
  return [...list].sort((left, right) =>
    left.title.localeCompare(right.title, 'pt-BR'),
  )
}

export function searchDocumentTree(
  nodes: Array<DocumentNode>,
  query: string,
): Array<DocumentMatch> {
  const term = normalizeSearchTerm(query)

  if (term.length === 0) {
    return []
  }

  const found: Array<DocumentMatch> = []

  function walk(list: Array<DocumentNode>, ancestors: Array<string>) {
    for (const node of list) {
      if (matches(node.title, term)) {
        found.push({
          id: node.id,
          title: node.title,
          path: ancestors.join(' / '),
          shared: false,
        })
      }

      walk(node.children, [...ancestors, node.title])
    }
  }

  walk(nodes, [])

  return sortMatches(found)
}

export function searchDocumentList(
  documents: Array<DocumentSummary>,
  query: string,
): Array<DocumentMatch> {
  const term = normalizeSearchTerm(query)

  if (term.length === 0) {
    return []
  }

  return sortMatches(
    documents
      .filter((document) => matches(document.title, term))
      .map((document) => ({
        id: document.id,
        title: document.title,
        path: '',
        shared: true,
      })),
  )
}

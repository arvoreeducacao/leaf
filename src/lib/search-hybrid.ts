import { isSemanticSearchEnabled } from '@/lib/embedding-config'
import {
  MAX_ASK_SOURCES,
  MAX_SEARCH_RESULTS,
  type DocumentPassage,
  type SearchHit,
  type ViewerKeys,
  buildSnippet,
  parseSnippet,
  queryTokens,
  searchAccessibleDocumentBodies,
  searchAccessibleDocuments,
} from '@/lib/search-index'
import { type SemanticHit, searchSemanticDocuments } from '@/lib/semantic-index'

export const RANK_FUSION_SMOOTHING = 60

async function semanticOrNothing(
  viewer: ViewerKeys,
  query: string,
  limit: number,
): Promise<Array<SemanticHit>> {
  if (!isSemanticSearchEnabled()) {
    return []
  }

  try {
    return await searchSemanticDocuments(viewer, query, limit)
  } catch {
    return []
  }
}

export function fusedOrder(
  rankings: ReadonlyArray<ReadonlyArray<string>>,
): Array<string> {
  const scores = new Map<string, number>()

  for (const ranking of rankings) {
    ranking.forEach((id, position) => {
      const gain = 1 / (RANK_FUSION_SMOOTHING + position + 1)

      scores.set(id, (scores.get(id) ?? 0) + gain)
    })
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id)
}

function hitFromChunk(
  hit: SemanticHit,
  tokens: Array<string>,
): SearchHit {
  return {
    id: hit.id,
    title: hit.title,
    icon: hit.icon,
    segments: parseSnippet(buildSnippet(hit.body, tokens)),
  }
}

export async function searchDocumentsHybrid(
  viewer: ViewerKeys,
  query: string,
  limit: number = MAX_SEARCH_RESULTS,
): Promise<Array<SearchHit>> {
  const [textual, semantic] = await Promise.all([
    searchAccessibleDocuments(viewer, query, limit * 2),
    semanticOrNothing(viewer, query, limit * 2),
  ])

  if (semantic.length === 0) {
    return textual.slice(0, limit)
  }

  const found = new Map(textual.map((hit) => [hit.id, hit]))
  const chunks = new Map(semantic.map((hit) => [hit.id, hit]))
  const tokens = queryTokens(query)

  return fusedOrder([
    textual.map((hit) => hit.id),
    semantic.map((hit) => hit.id),
  ])
    .slice(0, limit)
    .flatMap((id) => {
      const hit = found.get(id)

      if (hit !== undefined) {
        return [hit]
      }

      const chunk = chunks.get(id)

      return chunk === undefined ? [] : [hitFromChunk(chunk, tokens)]
    })
}

export async function askPassagesHybrid(
  viewer: ViewerKeys,
  question: string,
  limit: number = MAX_ASK_SOURCES,
): Promise<Array<DocumentPassage>> {
  const [textual, semantic] = await Promise.all([
    searchAccessibleDocumentBodies(viewer, question, limit),
    semanticOrNothing(viewer, question, limit),
  ])

  if (semantic.length === 0) {
    return textual.slice(0, limit)
  }

  const bodies = new Map(textual.map((passage) => [passage.id, passage]))
  const chunks = new Map(semantic.map((hit) => [hit.id, hit]))

  return fusedOrder([
    semantic.map((hit) => hit.id),
    textual.map((passage) => passage.id),
  ])
    .slice(0, limit)
    .flatMap((id) => {
      const chunk = chunks.get(id)

      if (chunk !== undefined) {
        return [{ id, title: chunk.title, body: chunk.body }]
      }

      const passage = bodies.get(id)

      return passage === undefined ? [] : [passage]
    })
}

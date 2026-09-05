import { type SQL, sql } from 'drizzle-orm'

import { blocksToPlainText } from '@/components/editor/text-stats'
import { db } from '@/db'
import { embedTexts } from '@/lib/embedding-client'
import {
  type EmbeddingConfig,
  readEmbeddingConfig,
} from '@/lib/embedding-config'
import {
  chunkText,
  decodeVector,
  dotProduct,
  encodeVector,
} from '@/lib/embedding-vector'
import {
  MAX_SEARCH_RESULTS,
  type ViewerKeys,
  accessCondition,
} from '@/lib/search-index'

export const SEMANTIC_DOCUMENT_BUDGET = 24
export const EMBEDDING_BATCH_SIZE = 96
export const SEMANTIC_CANDIDATE_CHUNKS = 200
export const SEMANTIC_SCORE_FLOOR = 0.2
export const VECTOR_CACHE_TTL = 30_000

const MAX_CHUNK_SOURCE = 200_000
const FLOAT_BYTES = 4

export type SemanticHit = Readonly<{
  id: string
  title: string
  icon: string | null
  body: string
  score: number
}>

type DocumentRow = Readonly<{
  id: string
  title: string
  content: string | null
  updatedAt: string
}>

type ChunkRow = Readonly<{
  documentId: string
  chunkIndex: number
  embedding: Buffer
  indexedAt: string
}>

type HitRow = Readonly<{
  id: string
  title: string
  icon: string | null
  chunkIndex: number
  body: string | null
}>

type CachedVector = Readonly<{
  documentId: string
  chunkIndex: number
  indexedAt: string
  vector: Float32Array
}>

type ScoredChunk = Readonly<{
  documentId: string
  chunkIndex: number
  score: number
}>

type VectorCache = {
  vectors: Array<CachedVector>
  total: number
  watermark: string | null
  checkedAt: number
}

async function selectRows<T>(query: SQL): Promise<Array<T>> {
  const result = (await db.execute(query)) as unknown as [Array<T>, unknown]

  return result[0]
}

function chunkSourceOf(content: string | null): string {
  if (!content) {
    return ''
  }

  try {
    return blocksToPlainText(JSON.parse(content)).slice(0, MAX_CHUNK_SOURCE)
  } catch {
    return ''
  }
}

function embeddingInput(title: string, chunk: string) {
  return `${title}\n\n${chunk}`
}

async function embedInBatches(
  config: EmbeddingConfig,
  values: ReadonlyArray<string>,
): Promise<Array<Float32Array>> {
  const vectors: Array<Float32Array> = []

  for (let start = 0; start < values.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = values.slice(start, start + EMBEDDING_BATCH_SIZE)

    vectors.push(...(await embedTexts(config, batch)))
  }

  return vectors
}

function chunkValues(
  row: DocumentRow,
  chunks: ReadonlyArray<string>,
  vectors: ReadonlyArray<Float32Array>,
  model: string,
): Array<SQL> {
  if (chunks.length === 0) {
    return [
      sql`(${row.id}, ${0}, ${''}, ${Buffer.alloc(0)}, ${model}, ${row.updatedAt})`,
    ]
  }

  return chunks.map(
    (body, index) =>
      sql`(${row.id}, ${index}, ${body}, ${encodeVector(vectors[index])}, ${model}, ${row.updatedAt})`,
  )
}

async function replaceChunks(
  row: DocumentRow,
  chunks: ReadonlyArray<string>,
  vectors: ReadonlyArray<Float32Array>,
  model: string,
) {
  await db.execute(
    sql`delete from document_chunks where document_id = ${row.id}`,
  )

  await db.execute(sql`
    insert into document_chunks (document_id, chunk_index, body, embedding, model, indexed_at)
    values ${sql.join(chunkValues(row, chunks, vectors, model), sql`, `)}
  `)
}

export async function removeDocumentChunks(documentId: string) {
  await db.execute(
    sql`delete from document_chunks where document_id = ${documentId}`,
  )
}

async function readDocument(documentId: string) {
  const rows = await selectRows<DocumentRow>(
    sql`select id, title, content, updated_at as updatedAt from documents where id = ${documentId}`,
  )

  return rows[0] ?? null
}

export async function indexDocumentChunks(documentId: string) {
  const config = readEmbeddingConfig(process.env)

  if (config === null) {
    await removeDocumentChunks(documentId)

    return
  }

  const row = await readDocument(documentId)

  if (row === null) {
    await removeDocumentChunks(documentId)

    return
  }

  const chunks = chunkText(chunkSourceOf(row.content))
  const vectors =
    chunks.length === 0
      ? []
      : await embedInBatches(
          config,
          chunks.map((chunk) => embeddingInput(row.title, chunk)),
        )

  await replaceChunks(row, chunks, vectors, config.model)
}

export async function reconcileSemanticIndex(
  budget: number = SEMANTIC_DOCUMENT_BUDGET,
): Promise<number> {
  const config = readEmbeddingConfig(process.env)

  if (config === null || budget <= 0) {
    return 0
  }

  const stale = await selectRows<DocumentRow>(sql`
    select d.id as id, d.title as title, d.content as content, d.updated_at as updatedAt
    from documents d
    left join document_chunks c on c.document_id = d.id and c.chunk_index = 0
    where d.deleted_at is null
      and (
        c.document_id is null
        or c.indexed_at <> d.updated_at
        or c.model <> ${config.model}
        or (
          length(c.embedding) > 0
          and length(c.embedding) <> ${config.dimensions * FLOAT_BYTES}
        )
      )
    order by d.updated_at desc
    limit ${budget}
  `)

  if (stale.length === 0) {
    return 0
  }

  const jobs = stale.map((row) => ({
    row,
    chunks: chunkText(chunkSourceOf(row.content)),
  }))

  const vectors = await embedInBatches(
    config,
    jobs.flatMap((job) =>
      job.chunks.map((chunk) => embeddingInput(job.row.title, chunk)),
    ),
  )

  let cursor = 0

  for (const job of jobs) {
    const taken = vectors.slice(cursor, cursor + job.chunks.length)

    cursor += job.chunks.length

    await replaceChunks(job.row, job.chunks, taken, config.model)
  }

  return jobs.length
}

let cache: VectorCache | null = null
let cacheRefresh: Promise<VectorCache> | null = null

export function clearSemanticCache() {
  cache = null
  cacheRefresh = null
}

type ChunkStats = Readonly<{ total: number; watermark: string | null }>

async function readChunkStats(): Promise<ChunkStats> {
  const rows = await selectRows<
    Readonly<{ total: number | string; watermark: string | null }>
  >(sql`select count(*) as total, max(indexed_at) as watermark from document_chunks`)

  return {
    total: Number(rows[0]?.total ?? 0),
    watermark: rows[0]?.watermark ?? null,
  }
}

async function readVectors(since: string | null): Promise<Array<CachedVector>> {
  const columns = sql`
    select
      document_id as documentId,
      chunk_index as chunkIndex,
      indexed_at as indexedAt,
      embedding as embedding
    from document_chunks
  `

  const rows = await selectRows<ChunkRow>(
    since === null ? columns : sql`${columns} where indexed_at >= ${since}`,
  )

  return rows.map((row) => ({
    documentId: row.documentId,
    chunkIndex: Number(row.chunkIndex),
    indexedAt: row.indexedAt,
    vector: decodeVector(row.embedding),
  }))
}

function watermarkOf(vectors: ReadonlyArray<CachedVector>): string | null {
  let latest: string | null = null

  for (const entry of vectors) {
    if (latest === null || entry.indexedAt > latest) {
      latest = entry.indexedAt
    }
  }

  return latest
}

function cacheOf(vectors: Array<CachedVector>): VectorCache {
  return {
    vectors,
    total: vectors.length,
    watermark: watermarkOf(vectors),
    checkedAt: Date.now(),
  }
}

async function loadEveryVector(): Promise<VectorCache> {
  return cacheOf(await readVectors(null))
}

async function refreshCache(current: VectorCache | null): Promise<VectorCache> {
  if (current === null || current.watermark === null) {
    return loadEveryVector()
  }

  const stats = await readChunkStats()

  if (stats.watermark === null || stats.total < current.total) {
    return loadEveryVector()
  }

  if (stats.total === current.total && stats.watermark === current.watermark) {
    current.checkedAt = Date.now()

    return current
  }

  const incoming = await readVectors(current.watermark)
  const touched = new Set(incoming.map((entry) => entry.documentId))
  const kept = current.vectors.filter((entry) => !touched.has(entry.documentId))
  const merged = [...kept, ...incoming]

  return merged.length === stats.total ? cacheOf(merged) : loadEveryVector()
}

async function cachedVectors(): Promise<ReadonlyArray<CachedVector>> {
  const current = cache

  if (current !== null && Date.now() - current.checkedAt < VECTOR_CACHE_TTL) {
    return current.vectors
  }

  if (cacheRefresh === null) {
    cacheRefresh = refreshCache(current)
      .then((next) => {
        cache = next

        return next
      })
      .finally(() => {
        cacheRefresh = null
      })
  }

  return (await cacheRefresh).vectors
}

function bestScoredChunks(
  query: Float32Array,
  vectors: ReadonlyArray<CachedVector>,
): Array<ScoredChunk> {
  const buffer: Array<ScoredChunk> = []
  let threshold = SEMANTIC_SCORE_FLOOR

  for (const entry of vectors) {
    const score = dotProduct(query, entry.vector)

    if (score <= threshold) {
      continue
    }

    buffer.push({
      documentId: entry.documentId,
      chunkIndex: entry.chunkIndex,
      score,
    })

    if (buffer.length >= SEMANTIC_CANDIDATE_CHUNKS * 2) {
      buffer.sort((left, right) => right.score - left.score)
      buffer.length = SEMANTIC_CANDIDATE_CHUNKS
      threshold = buffer[buffer.length - 1].score
    }
  }

  buffer.sort((left, right) => right.score - left.score)

  return buffer.slice(0, SEMANTIC_CANDIDATE_CHUNKS)
}

function bestChunkPerDocument(
  scored: ReadonlyArray<ScoredChunk>,
): Array<ScoredChunk> {
  const best = new Map<string, ScoredChunk>()

  for (const entry of scored) {
    const current = best.get(entry.documentId)

    if (current === undefined || entry.score > current.score) {
      best.set(entry.documentId, entry)
    }
  }

  return [...best.values()]
}

function chunkKey(documentId: string, chunkIndex: number) {
  return `${documentId}:${chunkIndex}`
}

export async function searchSemanticDocuments(
  viewer: ViewerKeys,
  query: string,
  limit: number = MAX_SEARCH_RESULTS,
): Promise<Array<SemanticHit>> {
  const config = readEmbeddingConfig(process.env)
  const term = query.trim()

  if (config === null || term.length === 0) {
    return []
  }

  const vectors = await cachedVectors()

  if (vectors.length === 0) {
    return []
  }

  const [embedded] = await embedTexts(config, [term])

  if (embedded === undefined) {
    return []
  }

  const winners = bestChunkPerDocument(bestScoredChunks(embedded, vectors))

  if (winners.length === 0) {
    return []
  }

  const pairs = winners.map(
    (winner) => sql`(${winner.documentId}, ${winner.chunkIndex})`,
  )

  const rows = await selectRows<HitRow>(sql`
    select
      d.id as id,
      d.title as title,
      d.icon as icon,
      c.chunk_index as chunkIndex,
      c.body as body
    from document_chunks c
    join documents d on d.id = c.document_id
    where (c.document_id, c.chunk_index) in (${sql.join(pairs, sql`, `)})
      and d.deleted_at is null
      and d.kind <> 'template'
      and ${accessCondition(viewer)}
  `)

  const scores = new Map(
    winners.map((winner) => [
      chunkKey(winner.documentId, winner.chunkIndex),
      winner.score,
    ]),
  )

  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      icon: row.icon,
      body: row.body ?? '',
      score: scores.get(chunkKey(row.id, Number(row.chunkIndex))) ?? 0,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

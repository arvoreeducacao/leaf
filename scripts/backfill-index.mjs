const CHUNK_TARGET_CHARS = 1200
const CHUNK_OVERLAP_CHARS = 200
const CHUNK_MIN_CHARS = 60
const MAX_CHUNKS_PER_DOCUMENT = 60
const MAX_INDEXED_BODY = 200000
const EMBEDDING_BATCH_SIZE = 96
const FLOAT_BYTES = 4
const SEARCH_PAGE_SIZE = 200
const CHUNK_PAGE_SIZE = 40
const PROGRESS_STEP = 100
const MAX_ATTEMPTS = 5
const RETRY_DELAY = 2000
const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_DIMENSIONS = 512
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const SENTENCE_BOUNDARY = /(?<=[.!?…:;])\s+/u

function collectInline(node, parts) {
  if (typeof node === 'string') {
    parts.push(node)

    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectInline(item, parts)
    }

    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  if (typeof node.text === 'string') {
    parts.push(node.text)
  }

  if (node.content !== undefined) {
    collectInline(node.content, parts)
  }

  if (Array.isArray(node.rows)) {
    for (const row of node.rows) {
      if (!Array.isArray(row?.cells)) {
        continue
      }

      for (const cell of row.cells) {
        collectInline(cell, parts)
        parts.push('\n')
      }
    }
  }
}

function blocksToPlainText(blocks) {
  const parts = []

  function walk(list) {
    if (!Array.isArray(list)) {
      return
    }

    for (const item of list) {
      if (!item || typeof item !== 'object') {
        continue
      }

      if (item.content !== undefined) {
        collectInline(item.content, parts)
      }

      parts.push('\n')
      walk(item.children)
    }
  }

  walk(blocks)

  return parts.join('')
}

function plainTextOf(content) {
  if (!content) {
    return ''
  }

  try {
    return blocksToPlainText(JSON.parse(content))
  } catch {
    return ''
  }
}

function documentBodyText(content) {
  return plainTextOf(content)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INDEXED_BODY)
}

function chunkSourceOf(content) {
  return plainTextOf(content).slice(0, MAX_INDEXED_BODY)
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/\n\s*\n+/gu, '\n')
    .trim()
}

function hardSplit(segment, target) {
  const pieces = []

  for (let start = 0; start < segment.length; start += target) {
    pieces.push(segment.slice(start, start + target).trim())
  }

  return pieces.filter((piece) => piece.length > 0)
}

function splitOversized(segment, target) {
  const sentences = segment.split(SENTENCE_BOUNDARY)
  const pieces = []
  let buffer = ''

  for (const sentence of sentences) {
    if (sentence.length > target) {
      if (buffer.length > 0) {
        pieces.push(buffer)
        buffer = ''
      }

      pieces.push(...hardSplit(sentence, target))

      continue
    }

    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`

    if (candidate.length > target) {
      pieces.push(buffer)
      buffer = sentence

      continue
    }

    buffer = candidate
  }

  if (buffer.length > 0) {
    pieces.push(buffer)
  }

  return pieces
}

function tailOf(chunk, overlap) {
  if (overlap <= 0 || chunk.length <= overlap) {
    return chunk
  }

  const tail = chunk.slice(chunk.length - overlap)
  const boundary = tail.search(/\s/u)

  return boundary === -1 ? tail : tail.slice(boundary + 1)
}

function chunkText(
  text,
  target = CHUNK_TARGET_CHARS,
  overlap = CHUNK_OVERLAP_CHARS,
) {
  const normalized = normalizeWhitespace(text)

  if (normalized.length === 0) {
    return []
  }

  const segments = normalized
    .split('\n')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap((segment) =>
      segment.length > target ? splitOversized(segment, target) : [segment],
    )

  const chunks = []
  let current = ''

  for (const segment of segments) {
    const candidate = current.length === 0 ? segment : `${current}\n${segment}`

    if (candidate.length <= target) {
      current = candidate

      continue
    }

    chunks.push(current)

    if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) {
      return chunks
    }

    const carry = tailOf(current, overlap)

    current = `${carry}\n${segment}`.slice(0, target)
  }

  if (current.length > 0) {
    if (current.length < CHUNK_MIN_CHARS && chunks.length > 0) {
      chunks.push(`${chunks.pop()}\n${current}`)
    } else {
      chunks.push(current)
    }
  }

  return chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT)
}

function normalizeVector(values) {
  const vector = Float32Array.from(values)
  let sum = 0

  for (const value of vector) {
    sum += value * value
  }

  const length = Math.sqrt(sum)

  if (length === 0) {
    return vector
  }

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= length
  }

  return vector
}

function encodeVector(vector) {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}

function connectionOptions(url) {
  const parsed = new URL(url)

  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    charset: 'UTF8MB4_UNICODE_CI',
    dateStrings: true,
    timezone: 'Z',
    supportBigNumbers: true,
  }
}

function readConfig(env) {
  const dimensions = Number(env.LEAF_EMBEDDING_DIMENSIONS)

  return {
    apiKey: env.OPENAI_API_KEY?.trim() ?? '',
    model: env.LEAF_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL,
    dimensions:
      Number.isInteger(dimensions) && dimensions > 0
        ? dimensions
        : DEFAULT_DIMENSIONS,
    baseUrl: (env.LEAF_EMBEDDING_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
      /\/$/,
      '',
    ),
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function embedBatch(config, values) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        dimensions: config.dimensions,
        input: values,
        encoding_format: 'float',
      }),
    })

    if (response.ok) {
      const payload = await response.json()

      return payload.data
        .slice()
        .sort((left, right) => left.index - right.index)
        .map((item) => normalizeVector(item.embedding))
    }

    const detail = (await response.text()).slice(0, 300)
    const retriable = response.status === 429 || response.status >= 500

    if (!retriable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`embeddings answered ${response.status}: ${detail}`)
    }

    console.warn(
      `[backfill] embeddings answered ${response.status}, retrying (${attempt}/${MAX_ATTEMPTS})`,
    )

    await wait(attempt * RETRY_DELAY)
  }
}

async function embedInBatches(config, values) {
  const vectors = []

  for (let start = 0; start < values.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = values.slice(start, start + EMBEDDING_BATCH_SIZE)

    vectors.push(...(await embedBatch(config, batch)))
  }

  return vectors
}

async function countLiveDocuments(connection) {
  const [rows] = await connection.query(
    'select count(*) as total from documents where deleted_at is null',
  )

  return Number(rows[0].total)
}

async function backfillSearchIndex(connection) {
  await connection.query(
    'delete f from documents_fts f left join documents d on d.id = f.document_id where d.id is null',
  )

  let done = 0

  for (;;) {
    const [rows] = await connection.query(
      `select d.id as id, d.title as title, d.content as content, d.updated_at as updatedAt
       from documents d
       left join documents_fts f on f.document_id = d.id
       where f.document_id is null or f.indexed_at <> d.updated_at
       order by d.updated_at desc
       limit ?`,
      [SEARCH_PAGE_SIZE],
    )

    if (rows.length === 0) {
      return done
    }

    for (const row of rows) {
      await connection.query(
        `insert into documents_fts (document_id, title, body, indexed_at)
         values (?, ?, ?, ?)
         on duplicate key update
           title = values(title),
           body = values(body),
           indexed_at = values(indexed_at)`,
        [row.id, row.title, documentBodyText(row.content), row.updatedAt],
      )

      done += 1

      if (done % PROGRESS_STEP === 0) {
        console.log(`[backfill] full text: ${done} documents`)
      }
    }
  }
}

async function writeChunks(connection, row, chunks, vectors, model) {
  const values =
    chunks.length === 0
      ? [[row.id, 0, '', Buffer.alloc(0), model, row.updatedAt]]
      : chunks.map((body, index) => [
          row.id,
          index,
          body,
          encodeVector(vectors[index]),
          model,
          row.updatedAt,
        ])

  await connection.query('delete from document_chunks where document_id = ?', [
    row.id,
  ])

  await connection.query(
    `insert into document_chunks (document_id, chunk_index, body, embedding, model, indexed_at)
     values ?`,
    [values],
  )
}

async function backfillChunks(connection, config) {
  let done = 0

  for (;;) {
    const [rows] = await connection.query(
      `select d.id as id, d.title as title, d.content as content, d.updated_at as updatedAt
       from documents d
       left join document_chunks c on c.document_id = d.id and c.chunk_index = 0
       where d.deleted_at is null
         and (
           c.document_id is null
           or c.indexed_at <> d.updated_at
           or c.model <> ?
           or (length(c.embedding) > 0 and length(c.embedding) <> ?)
         )
       order by d.updated_at desc
       limit ?`,
      [config.model, config.dimensions * FLOAT_BYTES, CHUNK_PAGE_SIZE],
    )

    if (rows.length === 0) {
      return done
    }

    const jobs = rows.map((row) => ({
      row,
      chunks: chunkText(chunkSourceOf(row.content)),
    }))

    const vectors = await embedInBatches(
      config,
      jobs.flatMap((job) =>
        job.chunks.map((chunk) => `${job.row.title}\n\n${chunk}`),
      ),
    )

    let cursor = 0

    for (const job of jobs) {
      const taken = vectors.slice(cursor, cursor + job.chunks.length)

      cursor += job.chunks.length

      await writeChunks(connection, job.row, job.chunks, taken, config.model)

      done += 1

      if (done % PROGRESS_STEP === 0) {
        console.log(`[backfill] embeddings: ${done} documents`)
      }
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined')
  }

  const config = readConfig(process.env)
  const mysql = (await import('mysql2/promise')).default
  const connection = await mysql.createConnection(
    connectionOptions(databaseUrl),
  )

  try {
    const total = await countLiveDocuments(connection)

    console.log(`[backfill] ${total} live documents in the workspace`)

    const indexed = await backfillSearchIndex(connection)

    console.log(`[backfill] full text: ${indexed} documents written`)

    if (config.apiKey.length === 0) {
      console.log('[backfill] no OPENAI_API_KEY, semantic search stays off')

      return
    }

    console.log(
      `[backfill] embedding with ${config.model} at ${config.dimensions} dimensions`,
    )

    const embedded = await backfillChunks(connection, config)

    console.log(`[backfill] embeddings: ${embedded} documents written`)
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[backfill] stopped:', error)
  process.exitCode = 1
})

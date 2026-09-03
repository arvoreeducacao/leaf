export const chunkTargetChars = 1_200
export const chunkOverlapChars = 200
export const chunkMinChars = 60
export const maxChunksPerDocument = 60

const SENTENCE_BOUNDARY = /(?<=[.!?…:;])\s+/u

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/\n\s*\n+/gu, '\n')
    .trim()
}

function hardSplit(segment: string, target: number): Array<string> {
  const pieces: Array<string> = []

  for (let start = 0; start < segment.length; start += target) {
    pieces.push(segment.slice(start, start + target).trim())
  }

  return pieces.filter((piece) => piece.length > 0)
}

function splitOversized(segment: string, target: number): Array<string> {
  const sentences = segment.split(SENTENCE_BOUNDARY)
  const pieces: Array<string> = []
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

function tailOf(chunk: string, overlap: number) {
  if (overlap <= 0 || chunk.length <= overlap) {
    return chunk
  }

  const tail = chunk.slice(chunk.length - overlap)
  const boundary = tail.search(/\s/u)

  return boundary === -1 ? tail : tail.slice(boundary + 1)
}

export function chunkText(
  text: string,
  target: number = chunkTargetChars,
  overlap: number = chunkOverlapChars,
): Array<string> {
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

  const chunks: Array<string> = []
  let current = ''

  for (const segment of segments) {
    const candidate = current.length === 0 ? segment : `${current}\n${segment}`

    if (candidate.length <= target) {
      current = candidate

      continue
    }

    chunks.push(current)

    if (chunks.length >= maxChunksPerDocument) {
      return chunks
    }

    const carry = tailOf(current, overlap)

    current = `${carry}\n${segment}`.slice(0, target)
  }

  if (current.length > 0) {
    if (current.length < chunkMinChars && chunks.length > 0) {
      const last = chunks.pop() as string

      chunks.push(`${last}\n${current}`)
    } else {
      chunks.push(current)
    }
  }

  return chunks.slice(0, maxChunksPerDocument)
}

export function normalizeVector(values: ArrayLike<number>): Float32Array {
  const vector = new Float32Array(values.length)
  let sum = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]

    vector[index] = value
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

export function encodeVector(values: ArrayLike<number>): Buffer {
  const vector =
    values instanceof Float32Array ? values : new Float32Array(values)

  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}

export function decodeVector(value: Buffer): Float32Array {
  const copy = Uint8Array.prototype.slice.call(value)

  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4)
}

export function dotProduct(left: Float32Array, right: Float32Array): number {
  const size = Math.min(left.length, right.length)
  let total = 0

  for (let index = 0; index < size; index += 1) {
    total += left[index] * right[index]
  }

  return total
}

import type { AiEnv } from '@/lib/ai-config'

export type EmbeddingConfig = Readonly<{
  apiKey: string
  model: string
  dimensions: number
  baseUrl: string | null
}>

export const embeddingDefaultModel = 'text-embedding-3-small'
export const embeddingDefaultDimensions = 512
export const embeddingMaxDimensions = 3_072

function readValue(env: AiEnv, name: string) {
  const value = env[name]?.trim()

  return value !== undefined && value.length > 0 ? value : null
}

export function embeddingDimensionsOf(env: AiEnv) {
  const configured = Number(readValue(env, 'LEAF_EMBEDDING_DIMENSIONS'))

  return Number.isInteger(configured) &&
    configured > 0 &&
    configured <= embeddingMaxDimensions
    ? configured
    : embeddingDefaultDimensions
}

export function readEmbeddingConfig(env: AiEnv): EmbeddingConfig | null {
  const apiKey = readValue(env, 'OPENAI_API_KEY')

  if (apiKey === null) {
    return null
  }

  return {
    apiKey,
    model: readValue(env, 'LEAF_EMBEDDING_MODEL') ?? embeddingDefaultModel,
    dimensions: embeddingDimensionsOf(env),
    baseUrl: readValue(env, 'LEAF_EMBEDDING_BASE_URL'),
  }
}

export function isSemanticSearchEnabled(env: AiEnv = process.env) {
  return readEmbeddingConfig(env) !== null
}

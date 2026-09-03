import { createOpenAI } from '@ai-sdk/openai'
import { embedMany } from 'ai'

import type { EmbeddingConfig } from '@/lib/embedding-config'
import { normalizeVector } from '@/lib/embedding-vector'

function providerOf(config: EmbeddingConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl === null ? {} : { baseURL: config.baseUrl }),
  })
}

export async function embedTexts(
  config: EmbeddingConfig,
  values: ReadonlyArray<string>,
): Promise<Array<Float32Array>> {
  if (values.length === 0) {
    return []
  }

  const { embeddings } = await embedMany({
    model: providerOf(config).textEmbeddingModel(config.model),
    values: [...values],
    providerOptions: { openai: { dimensions: config.dimensions } },
  })

  return embeddings.map((embedding) => normalizeVector(embedding))
}

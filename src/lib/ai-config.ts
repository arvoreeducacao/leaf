export type AiProvider = 'anthropic' | 'openai'

export type AiEnv = Readonly<Record<string, string | undefined>>

export type AiConfig = Readonly<{
  provider: AiProvider
  model: string
  apiKey: string
  baseUrl: string | null
  maxOutputTokens: number
}>

export const aiApiKeyNames: Record<AiProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

export const aiDefaultModels: Record<AiProvider, string | null> = {
  anthropic: 'claude-sonnet-5',
  openai: null,
}

export const aiDefaultMaxOutputTokens = 8_192

function readValue(env: AiEnv, name: string) {
  const value = env[name]?.trim()

  return value !== undefined && value.length > 0 ? value : null
}

function providerOfModel(model: string | null): AiProvider | null {
  if (model === null) {
    return null
  }

  const normalized = model.toLowerCase()

  if (normalized.startsWith('claude')) {
    return 'anthropic'
  }

  if (normalized.startsWith('gpt') || /^o\d/u.test(normalized)) {
    return 'openai'
  }

  return null
}

export function aiProviderOf(env: AiEnv): AiProvider | null {
  const configured = readValue(env, 'LEAF_AI_PROVIDER')?.toLowerCase()

  if (configured !== undefined && configured !== null) {
    return configured === 'anthropic' || configured === 'openai'
      ? configured
      : null
  }

  const fromModel = providerOfModel(readValue(env, 'LEAF_AI_MODEL'))

  if (fromModel !== null) {
    return fromModel
  }

  if (readValue(env, aiApiKeyNames.anthropic) !== null) {
    return 'anthropic'
  }

  if (readValue(env, aiApiKeyNames.openai) !== null) {
    return 'openai'
  }

  return null
}

export function aiMaxOutputTokens(env: AiEnv) {
  const configured = Number(readValue(env, 'LEAF_AI_MAX_OUTPUT_TOKENS'))

  return Number.isInteger(configured) && configured > 0
    ? configured
    : aiDefaultMaxOutputTokens
}

export function readAiConfig(env: AiEnv): AiConfig | null {
  const provider = aiProviderOf(env)

  if (provider === null) {
    return null
  }

  const apiKey = readValue(env, aiApiKeyNames[provider])

  if (apiKey === null) {
    return null
  }

  const model = readValue(env, 'LEAF_AI_MODEL') ?? aiDefaultModels[provider]

  if (model === null) {
    return null
  }

  return {
    provider,
    model,
    apiKey,
    baseUrl: readValue(env, 'LEAF_AI_BASE_URL'),
    maxOutputTokens: aiMaxOutputTokens(env),
  }
}

export function isAiEnabled(env: AiEnv = process.env) {
  return readAiConfig(env) !== null
}

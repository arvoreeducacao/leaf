import { describe, expect, it } from 'vitest'

import {
  aiDefaultMaxOutputTokens,
  aiMaxOutputTokens,
  aiProviderOf,
  readAiConfig,
} from '@/lib/ai-config'

describe('aiProviderOf', () => {
  it('has no provider without any key', () => {
    expect(aiProviderOf({})).toBeNull()
  })

  it('infers the provider from the key that is set', () => {
    expect(aiProviderOf({ ANTHROPIC_API_KEY: 'sk-ant' })).toBe('anthropic')
    expect(aiProviderOf({ OPENAI_API_KEY: 'sk-openai' })).toBe('openai')
  })

  it('infers the provider from the model name', () => {
    expect(
      aiProviderOf({ LEAF_AI_MODEL: 'gpt-5', ANTHROPIC_API_KEY: 'sk-ant' }),
    ).toBe('openai')
    expect(aiProviderOf({ LEAF_AI_MODEL: 'o3-mini' })).toBe('openai')
    expect(aiProviderOf({ LEAF_AI_MODEL: 'claude-opus-5' })).toBe('anthropic')
  })

  it('lets the environment name the provider', () => {
    expect(
      aiProviderOf({
        LEAF_AI_PROVIDER: 'OpenAI',
        ANTHROPIC_API_KEY: 'sk-ant',
      }),
    ).toBe('openai')
  })

  it('has no provider when the name is not one we speak', () => {
    expect(
      aiProviderOf({ LEAF_AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'sk' }),
    ).toBeNull()
  })

  it('ignores blank values', () => {
    expect(aiProviderOf({ ANTHROPIC_API_KEY: '   ' })).toBeNull()
  })
})

describe('aiMaxOutputTokens', () => {
  it('falls back to the default', () => {
    expect(aiMaxOutputTokens({})).toBe(aiDefaultMaxOutputTokens)
    expect(aiMaxOutputTokens({ LEAF_AI_MAX_OUTPUT_TOKENS: 'many' })).toBe(
      aiDefaultMaxOutputTokens,
    )
    expect(aiMaxOutputTokens({ LEAF_AI_MAX_OUTPUT_TOKENS: '0' })).toBe(
      aiDefaultMaxOutputTokens,
    )
  })

  it('takes the configured ceiling', () => {
    expect(aiMaxOutputTokens({ LEAF_AI_MAX_OUTPUT_TOKENS: '16000' })).toBe(
      16_000,
    )
  })
})

describe('readAiConfig', () => {
  it('stays off without a key', () => {
    expect(readAiConfig({})).toBeNull()
    expect(readAiConfig({ LEAF_AI_MODEL: 'claude-sonnet-5' })).toBeNull()
  })

  it('stays off when the provider has no key of its own', () => {
    expect(
      readAiConfig({ LEAF_AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'sk-ant' }),
    ).toBeNull()
  })

  it('reads the anthropic default model', () => {
    expect(readAiConfig({ ANTHROPIC_API_KEY: 'sk-ant' })).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      apiKey: 'sk-ant',
      baseUrl: null,
      maxOutputTokens: aiDefaultMaxOutputTokens,
    })
  })

  it('asks openai for an explicit model, since there is no default', () => {
    expect(readAiConfig({ OPENAI_API_KEY: 'sk-openai' })).toBeNull()
    expect(
      readAiConfig({ OPENAI_API_KEY: 'sk-openai', LEAF_AI_MODEL: 'gpt-5' }),
    ).toEqual({
      provider: 'openai',
      model: 'gpt-5',
      apiKey: 'sk-openai',
      baseUrl: null,
      maxOutputTokens: aiDefaultMaxOutputTokens,
    })
  })

  it('carries the gateway url and the ceiling', () => {
    expect(
      readAiConfig({
        ANTHROPIC_API_KEY: 'sk-ant',
        LEAF_AI_MODEL: 'claude-opus-5',
        LEAF_AI_BASE_URL: 'https://gateway.example.com/anthropic',
        LEAF_AI_MAX_OUTPUT_TOKENS: '12000',
      }),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5',
      apiKey: 'sk-ant',
      baseUrl: 'https://gateway.example.com/anthropic',
      maxOutputTokens: 12_000,
    })
  })
})

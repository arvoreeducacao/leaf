import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

import type { AiConfig } from '@/lib/ai-config'

export const aiSystemPrompt = [
  'You are the writing assistant inside Leaf, a collaborative block editor.',
  'Always write in the same language as the document you are editing.',
  'Keep the voice, the terminology and the formatting of the author, and change only what the instruction asks for.',
  'Never invent facts, numbers, links or citations that are not in the document.',
  'When the instruction is a question about the content, answer it as new text in the document.',
].join(' ')

export function createAiModel(config: AiConfig): LanguageModel {
  const settings = {
    apiKey: config.apiKey,
    ...(config.baseUrl === null ? {} : { baseURL: config.baseUrl }),
  }

  return config.provider === 'anthropic'
    ? createAnthropic(settings)(config.model)
    : createOpenAI(settings)(config.model)
}

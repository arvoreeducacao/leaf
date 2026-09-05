import type { DatabaseProperty } from '@/db/schema'
import { escapeSlackText } from '@/lib/slack/text'

import {
  type FormConfig,
  type ResolvedQuestion,
  TITLE_QUESTION_ID,
  attachmentLinks,
  resolveQuestions,
} from './forms'
import { type PropertyValues, parseOptions, valueToText } from './values'

export const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/services/'
export const MAX_SLACK_ANSWER = 900
export const MAX_SLACK_MESSAGE = 12_000

export function isSlackWebhook(url: string): boolean {
  return url.startsWith(SLACK_WEBHOOK_PREFIX) && url.length <= 500
}

type PropertyLike = Pick<DatabaseProperty, 'id' | 'name' | 'type' | 'options'>

function clamp(text: string): string {
  const trimmed = text.trim()

  return escapeSlackText(
    trimmed.length > MAX_SLACK_ANSWER
      ? `${trimmed.slice(0, MAX_SLACK_ANSWER)}…`
      : trimmed,
  )
}

function answerOf(
  question: ResolvedQuestion,
  values: PropertyValues,
  property: PropertyLike | undefined,
): string {
  const raw = values[question.propertyId]

  if (raw === undefined || raw === null) {
    return ''
  }

  if (question.attachment) {
    return attachmentLinks(String(raw).split('\n')).join('\n')
  }

  const options = property ? parseOptions(property.options) : []

  return clamp(valueToText(raw, question.type, options))
}

export function slackMessageFor(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
  formUrl: string | null = null,
): string {
  const questions = resolveQuestions(config, properties, titleName)
  const byId = new Map(properties.map((property) => [property.id, property]))
  const blocks: Array<string> = []

  const heading = escapeSlackText(
    title.trim().length > 0 ? title.trim() : titleName,
  )

  blocks.push(`*${heading}*`)

  for (const question of questions) {
    if (question.propertyId === TITLE_QUESTION_ID) {
      continue
    }

    const answer = answerOf(question, values, byId.get(question.propertyId))

    if (answer.length === 0) {
      continue
    }

    blocks.push(`*${escapeSlackText(question.name)}*\n${answer}`)
  }

  if (formUrl) {
    blocks.push(`<${formUrl}|Responder o formulário>`)
  }

  return blocks.join('\n\n').slice(0, MAX_SLACK_MESSAGE)
}

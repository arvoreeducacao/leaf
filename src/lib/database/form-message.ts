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
export const MAX_SLACK_BLOCKS = 45

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

function sections(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
): Array<string> {
  const questions = resolveQuestions(config, properties, titleName)
  const byId = new Map(properties.map((property) => [property.id, property]))
  const heading = escapeSlackText(
    title.trim().length > 0 ? title.trim() : titleName,
  )
  const parts = [`*${heading}*`]

  for (const question of questions) {
    if (question.propertyId === TITLE_QUESTION_ID) {
      continue
    }

    const answer = answerOf(question, values, byId.get(question.propertyId))

    if (answer.length > 0) {
      parts.push(`*${escapeSlackText(question.name)}*\n${answer}`)
    }
  }

  return parts
}

export function slackMessageFor(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
): string {
  return sections(config, properties, title, values, titleName)
    .join('\n\n')
    .slice(0, MAX_SLACK_MESSAGE)
}

export type SlackPayload = Readonly<{
  text: string
  blocks: ReadonlyArray<unknown>
}>

export function slackPayloadFor(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
  rowUrl: string | null,
  openLabel: string,
): SlackPayload {
  const parts = sections(config, properties, title, values, titleName)

  const blocks: Array<unknown> = parts
    .slice(0, MAX_SLACK_BLOCKS)
    .map((text) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: text.slice(0, 3000) },
    }))

  if (rowUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: openLabel, emoji: false },
          url: rowUrl,
        },
      ],
    })
  }

  return {
    text: parts.join('\n\n').slice(0, MAX_SLACK_MESSAGE),
    blocks,
  }
}

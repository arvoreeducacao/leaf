import type { DatabaseProperty } from '@/db/schema'
import { escapeSlackText } from '@/lib/slack/text'

import {
  type FormConfig,
  type ResolvedQuestion,
  TITLE_QUESTION_ID,
  attachmentLinks,
  resolveQuestions,
} from './forms'
import {
  type PropertyValues,
  fileNameOf,
  isImageFileUrl,
  parseOptions,
  valueToText,
} from './values'

export const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/services/'
export const MAX_SLACK_ANSWER = 900
export const MAX_SLACK_MESSAGE = 12_000
export const MAX_SLACK_BLOCKS = 45
export const MAX_SLACK_IMAGES = 5

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

function absoluteUrl(url: string, baseUrl: string): string {
  return url.startsWith('/') ? `${baseUrl}${url}` : url
}

function fileAddressesOf(raw: unknown): Array<string> {
  return attachmentLinks(Array.isArray(raw) ? raw : String(raw).split('\n'))
}

function answerOf(
  question: ResolvedQuestion,
  values: PropertyValues,
  property: PropertyLike | undefined,
  baseUrl: string,
): string {
  const raw = values[question.propertyId]

  if (raw === undefined || raw === null) {
    return ''
  }

  if (question.attachment) {
    return fileAddressesOf(raw)
      .map((url) => absoluteUrl(url, baseUrl))
      .join('\n')
  }

  const options = property ? parseOptions(property.options) : []

  return clamp(valueToText(raw, question.type, options))
}

type Section = Readonly<{ text: string; images: ReadonlyArray<string> }>

function sections(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
  baseUrl: string,
): Array<Section> {
  const questions = resolveQuestions(config, properties, titleName)
  const byId = new Map(properties.map((property) => [property.id, property]))
  const heading = escapeSlackText(
    title.trim().length > 0 ? title.trim() : titleName,
  )
  const parts: Array<Section> = [{ images: [], text: `*${heading}*` }]

  for (const question of questions) {
    if (question.propertyId === TITLE_QUESTION_ID) {
      continue
    }

    const answer = answerOf(
      question,
      values,
      byId.get(question.propertyId),
      baseUrl,
    )

    if (answer.length === 0) {
      continue
    }

    const images = question.attachment
      ? answer.split('\n').filter(isImageFileUrl)
      : []

    parts.push({
      images,
      text: `*${escapeSlackText(question.name)}*\n${answer}`,
    })
  }

  return parts
}

export function slackMessageFor(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  title: string,
  values: PropertyValues,
  titleName: string,
  baseUrl = '',
): string {
  return sections(config, properties, title, values, titleName, baseUrl)
    .map((part) => part.text)
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
  baseUrl = '',
): SlackPayload {
  const parts = sections(config, properties, title, values, titleName, baseUrl)
  const blocks: Array<unknown> = []
  let shown = 0

  for (const part of parts.slice(0, MAX_SLACK_BLOCKS)) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: part.text.slice(0, 3000) },
    })

    for (const image of part.images) {
      if (shown >= MAX_SLACK_IMAGES || blocks.length >= MAX_SLACK_BLOCKS) {
        break
      }

      blocks.push({
        type: 'image',
        image_url: image,
        alt_text: fileNameOf(image),
      })
      shown += 1
    }
  }

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
    text: parts
      .map((part) => part.text)
      .join('\n\n')
      .slice(0, MAX_SLACK_MESSAGE),
    blocks,
  }
}

import { describe, expect, it } from 'vitest'

import type { DatabaseProperty } from '@/db/schema'

import {
  MAX_SLACK_ANSWER,
  isSlackWebhook,
  slackMessageFor,
} from './form-message'
import { TITLE_QUESTION_ID, parseFormConfig } from './forms'
import { serializeOptions } from './values'

function property(
  overrides: Partial<DatabaseProperty> &
    Pick<DatabaseProperty, 'id' | 'name' | 'type'>,
): DatabaseProperty {
  return {
    databaseId: 'db',
    options: null,
    position: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as DatabaseProperty
}

const severity = property({
  id: 'severity',
  name: 'Gravidade',
  type: 'multiSelect',
  options: serializeOptions([
    { id: 'high', name: '🔴 (Precisa ser priorizado no próximo ciclo)', color: 'error' },
    { id: 'low', name: '🟢 (Pode ser priorizado ao longo dos meses)', color: 'blue' },
  ]),
})

const who = property({ id: 'who', name: 'Nome', type: 'text' })
const description = property({ id: 'desc', name: 'Descrição', type: 'text' })
const files = property({ id: 'files', name: 'Prints & Anexos', type: 'text' })
const empty = property({ id: 'empty', name: 'Vertente', type: 'multiSelect' })

const properties = [who, severity, description, files, empty]

const config = parseFormConfig({
  questions: [
    { propertyId: 'who' },
    { propertyId: TITLE_QUESTION_ID },
    { propertyId: 'severity' },
    { propertyId: 'desc' },
    { propertyId: 'files', attachment: true },
    { propertyId: 'empty' },
  ],
})!

describe('isSlackWebhook', () => {
  it('accepts only the Slack incoming webhook address', () => {
    expect(isSlackWebhook('https://hooks.slack.com/services/T1/B2/abc')).toBe(true)
    expect(isSlackWebhook('https://hooks.slack.com.evil.example/services/x')).toBe(false)
    expect(isSlackWebhook('http://hooks.slack.com/services/T1/B2/abc')).toBe(false)
    expect(isSlackWebhook('https://example.com/webhook')).toBe(false)
    expect(isSlackWebhook('')).toBe(false)
  })
})

describe('slackMessageFor', () => {
  const values = {
    who: 'Carol Uehara',
    severity: ['high'],
    desc: 'Os ícones se sobrepõem ao texto',
    files: '/api/uploads/u/print.png',
    empty: [],
  }

  it('escapes what would break the message in Slack', () => {
    const text = slackMessageFor(
      config,
      properties,
      'a < b & c',
      { ...values, desc: 'olhe <https://exemplo.test|aqui> & veja' },
      'Nome',
    )

    expect(text).toContain('*a &lt; b &amp; c*')
    expect(text).toContain('olhe &lt;https://exemplo.test|aqui&gt; &amp; veja')
  })

  it('opens with the row title and names every answered question', () => {
    const text = slackMessageFor(
      config,
      properties,
      'Ícones de acessibilidade',
      values,
      'Nome',
    )

    expect(text.startsWith('*Ícones de acessibilidade*')).toBe(true)
    expect(text).toContain('*Nome*\nCarol Uehara')
    expect(text).toContain('*Gravidade*\n🔴 (Precisa ser priorizado no próximo ciclo)')
    expect(text).toContain('*Descrição*\nOs ícones se sobrepõem ao texto')
  })

  it('leaves out a question nobody answered', () => {
    const text = slackMessageFor(config, properties, 'x', values, 'Nome')

    expect(text).not.toContain('Vertente')
  })

  it('does not repeat the title as a question', () => {
    const text = slackMessageFor(config, properties, 'Título', values, 'Nome')

    expect(text.match(/Título/g)).toHaveLength(1)
  })

  it('keeps only attachment links this Leaf stored', () => {
    const text = slackMessageFor(
      config,
      properties,
      'x',
      { ...values, files: '/api/uploads/u/a.png\nhttps://evil.example/b.png' },
      'Nome',
    )

    expect(text).toContain('/api/uploads/u/a.png')
    expect(text).not.toContain('evil.example')
  })

  it('cuts a very long answer instead of flooding the channel', () => {
    const text = slackMessageFor(
      config,
      properties,
      'x',
      { ...values, desc: 'a'.repeat(MAX_SLACK_ANSWER + 500) },
      'Nome',
    )

    expect(text).toContain('…')
    expect(text.length).toBeLessThan(MAX_SLACK_ANSWER + 400)
  })

  it('falls back to the title column name when the row has no title', () => {
    const text = slackMessageFor(config, properties, '   ', values, 'Sem título')

    expect(text.startsWith('*Sem título*')).toBe(true)
  })
})

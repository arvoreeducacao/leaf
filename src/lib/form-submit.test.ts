import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))

vi.mock('@/lib/auth', () => ({ getSession: async () => null }))

vi.mock('@/lib/search-index', () => ({ indexDocument: async () => undefined }))

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documents,
  formWebhooks,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { resetFormSubmissionLimiter } from '@/lib/authz'
import { emptyFormConfig } from '@/lib/database/forms'
import { serializeOptions } from '@/lib/database/values'
import { emptyViewConfig, serializeViewConfig } from '@/lib/database/views'
import { submitForm } from '@/lib/form-actions'

const WEBHOOK = 'https://hooks.slack.com/services/T1/B2/segredo'
const TOKEN = 'token-do-formulario-de-teste'
const now = new Date('2026-09-05T12:00:00.000Z')

const severityOptions = [
  { id: 'high', name: 'Alta', color: 'error' as const },
  { id: 'low', name: 'Baixa', color: 'blue' as const },
]

function config(overrides: Partial<typeof emptyFormConfig> = {}) {
  return serializeViewConfig({
    ...emptyViewConfig,
    form: {
      ...emptyFormConfig,
      questions: [
        {
          propertyId: 'title',
          label: 'Título',
          description: '',
          required: true,
          attachment: false,
          long: false,
        },
        {
          propertyId: 'prop-severity',
          label: '',
          description: '',
          required: false,
          attachment: false,
          long: false,
        },
      ],
      ...overrides,
    },
  })
}

async function seed(viewConfig: string, withWebhook = true) {
  await resetDatabase()
  resetFormSubmissionLimiter()

  await db.insert(user).values({
    id: 'user-owner',
    name: 'Owner',
    email: 'owner@example.com',
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(documents).values({
    id: 'base',
    ownerId: 'user-owner',
    kind: 'database',
    title: 'Feedbacks',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(databaseProperties).values({
    id: 'prop-severity',
    databaseId: 'base',
    name: 'Gravidade',
    type: 'select',
    options: serializeOptions(severityOptions),
    position: 0,
    createdAt: now,
  })

  await db.insert(databaseViews).values({
    id: 'view-form',
    databaseId: 'base',
    name: 'Formulário',
    type: 'form',
    config: viewConfig,
    publicToken: TOKEN,
    position: 0,
    createdAt: now,
  })

  if (withWebhook) {
    await db.insert(formWebhooks).values({ viewId: 'view-form', url: WEBHOOK })
  }
}

type PostedBlock = { type: string; elements?: Array<{ url: string }> }

function captureFetch(behaviour: 'ok' | 'throws' = 'ok') {
  const calls: Array<{ url: string; text: string; blocks: Array<PostedBlock> }> =
    []

  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      text: string
      blocks: Array<PostedBlock>
    }

    calls.push({ url: String(url), text: body.text, blocks: body.blocks })

    if (behaviour === 'throws') {
      throw new Error('slack fora do ar')
    }

    return new Response('ok')
  })

  return calls
}

const answers = { title: 'Floresta não abre', 'prop-severity': 'high' }

describe('a resposta do formulário no Slack', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('manda uma mensagem para o canal configurado', async () => {
    await seed(config())

    const calls = captureFetch()
    const result = await submitForm(TOKEN, answers)

    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(WEBHOOK)
    expect(calls[0].text).toContain('*Floresta não abre*')
    expect(calls[0].text).toContain('*Gravidade*\nAlta')
  })

  it('fecha a mensagem com o botão que abre a linha criada', async () => {
    await seed(config())

    const calls = captureFetch()

    expect((await submitForm(TOKEN, answers)).ok).toBe(true)

    const last = calls[0].blocks.at(-1)
    const rows = await db.query.documents.findMany({
      where: (fields, { eq }) => eq(fields.parentId, 'base'),
    })

    expect(last?.type).toBe('actions')
    expect(last?.elements?.[0].url).toContain(`/doc/${rows[0].id}`)
  })

  it('fica quieta quando o aviso está desligado', async () => {
    await seed(config({ notify: false }))

    const calls = captureFetch()

    expect((await submitForm(TOKEN, answers)).ok).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('fica quieta quando nenhum canal foi configurado', async () => {
    await seed(config(), false)

    const calls = captureFetch()

    expect((await submitForm(TOKEN, answers)).ok).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('grava a resposta mesmo quando o Slack não responde', async () => {
    await seed(config())
    captureFetch('throws')

    expect((await submitForm(TOKEN, answers)).ok).toBe(true)

    const rows = await db.query.documents.findMany({
      where: (fields, { eq }) => eq(fields.parentId, 'base'),
    })

    expect(rows.map((row) => row.title)).toEqual(['Floresta não abre'])
  })

  it('não manda nada quando o formulário parou de receber respostas', async () => {
    await seed(config({ accepting: false }))

    const calls = captureFetch()

    expect((await submitForm(TOKEN, answers)).ok).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

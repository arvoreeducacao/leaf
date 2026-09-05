import { describe, expect, it } from 'vitest'

import type { DatabaseProperty } from '@/db/schema'

import {
  TITLE_QUESTION_ID,
  applyAutomations,
  attachmentLinks,
  buildSubmission,
  parseFormConfig,
  resolveQuestions,
  seedFormConfig,
  serializeFormConfig,
} from './forms'
import { serializeOptions } from './values'

const titleName = 'Nome'

function property(
  overrides: Partial<DatabaseProperty> & Pick<DatabaseProperty, 'id' | 'name' | 'type'>,
): DatabaseProperty {
  return {
    databaseId: 'db',
    options: null,
    position: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as DatabaseProperty
}

const status = property({
  id: 'status',
  name: 'Status',
  type: 'status',
  options: serializeOptions([
    { id: 'sent', name: 'Enviada', color: 'gray', group: 'todo' },
    { id: 'triage', name: 'Triando', color: 'blue', group: 'doing' },
  ]),
})

const submittedAt = property({ id: 'sent-at', name: 'Horário do envio', type: 'date' })
const participant = property({ id: 'who', name: 'Participante', type: 'person' })
const description = property({ id: 'desc', name: 'Descrição', type: 'text' })
const attachments = property({ id: 'files', name: 'Prints', type: 'text' })

const severity = property({
  id: 'severity',
  name: 'Gravidade',
  type: 'multiSelect',
  options: serializeOptions([
    { id: 'low', name: 'Baixa', color: 'blue' },
    { id: 'high', name: 'Alta', color: 'error' },
  ]),
})

const properties = [status, submittedAt, participant, description, attachments, severity]

const context = { submittedOn: '2026-09-05', submitterId: 'user-1' }

describe('seedFormConfig', () => {
  it('turns every answerable property into a question and keeps the title first', () => {
    const config = seedFormConfig(properties, titleName)

    expect(config.questions.map((question) => question.propertyId)).toEqual([
      TITLE_QUESTION_ID,
      'status',
      'sent-at',
      'desc',
      'files',
      'severity',
    ])
    expect(config.questions[0].required).toBe(true)
  })

  it('fills the person property by automation instead of asking for it', () => {
    const config = seedFormConfig(properties, titleName)

    expect(config.automations).toContainEqual({
      kind: 'submittedBy',
      propertyId: 'who',
      value: null,
    })
  })

  it('starts a status property on its first to-do option', () => {
    const config = seedFormConfig(properties, titleName)

    expect(config.automations).toContainEqual({
      kind: 'presetValue',
      propertyId: 'status',
      value: 'sent',
    })
  })
})

describe('parseFormConfig', () => {
  it('survives a round trip', () => {
    const config = seedFormConfig(properties, titleName)

    expect(parseFormConfig(JSON.parse(JSON.stringify(serializeFormConfig(config))))).toEqual(
      config,
    )
  })

  it('drops questions without a property and keeps one entry per property', () => {
    const config = parseFormConfig({
      questions: [
        { propertyId: 'desc' },
        { propertyId: 'desc', required: true },
        { required: true },
      ],
    })

    expect(config?.questions).toEqual([
      {
        propertyId: 'desc',
        label: '',
        description: '',
        required: false,
        attachment: false,
        long: false,
      },
    ])
  })

  it('reads a missing accepting flag as open', () => {
    expect(parseFormConfig({})?.accepting).toBe(true)
    expect(parseFormConfig({ accepting: false })?.accepting).toBe(false)
  })

  it('refuses anything that is not an object', () => {
    expect(parseFormConfig(null)).toBeNull()
    expect(parseFormConfig([])).toBeNull()
    expect(parseFormConfig('x')).toBeNull()
  })
})

describe('resolveQuestions', () => {
  it('drops a question whose property was deleted', () => {
    const config = parseFormConfig({
      questions: [{ propertyId: 'desc' }, { propertyId: 'gone' }],
    })

    expect(
      resolveQuestions(config!, properties, titleName).map((item) => item.propertyId),
    ).toEqual(['desc'])
  })

  it('never asks for a person property', () => {
    const config = parseFormConfig({ questions: [{ propertyId: 'who' }] })

    expect(resolveQuestions(config!, properties, titleName)).toEqual([])
  })

  it('falls back to the property name when the question has no label', () => {
    const config = parseFormConfig({
      questions: [{ propertyId: 'desc' }, { propertyId: 'severity', label: 'Quão grave?' }],
    })

    expect(
      resolveQuestions(config!, properties, titleName).map((item) => item.name),
    ).toEqual(['Descrição', 'Quão grave?'])
  })

  it('only offers a long answer on a text property that is not an attachment', () => {
    const config = parseFormConfig({
      questions: [
        { propertyId: 'desc', long: true },
        { propertyId: 'severity', long: true },
        { propertyId: 'files', long: true, attachment: true },
      ],
    })

    expect(
      resolveQuestions(config!, properties, titleName).map((item) => item.long),
    ).toEqual([true, false, false])
  })

  it('only marks an attachment question on a text property', () => {
    const config = parseFormConfig({
      questions: [
        { propertyId: 'files', attachment: true },
        { propertyId: 'severity', attachment: true },
      ],
    })

    expect(
      resolveQuestions(config!, properties, titleName).map((item) => item.attachment),
    ).toEqual([true, false])
  })
})

describe('attachmentLinks', () => {
  it('keeps only links this Leaf stored', () => {
    expect(
      attachmentLinks([
        '/api/uploads/u/abc.png',
        'https://evil.example/x.png',
        'javascript:alert(1)',
        42,
      ]),
    ).toEqual(['/api/uploads/u/abc.png'])
  })
})

describe('applyAutomations', () => {
  it('stamps the submission date and the submitter', () => {
    const config = seedFormConfig(properties, titleName)

    const values = applyAutomations(
      { ...config, automations: [
        { kind: 'submittedAt', propertyId: 'sent-at', value: null },
        { kind: 'submittedBy', propertyId: 'who', value: null },
      ] },
      properties,
      {},
      context,
    )

    expect(values['sent-at']).toBe('2026-09-05')
    expect(values.who).toEqual(['user-1'])
  })

  it('leaves the submitter empty when nobody is signed in', () => {
    const config = seedFormConfig(properties, titleName)

    const values = applyAutomations(config, properties, {}, {
      ...context,
      submitterId: null,
    })

    expect(values.who).toEqual([])
  })

  it('does not overwrite an answer with a preset', () => {
    const config = seedFormConfig(properties, titleName)

    expect(
      applyAutomations(config, properties, { status: 'triage' }, context).status,
    ).toBe('triage')
    expect(applyAutomations(config, properties, {}, context).status).toBe('sent')
  })

  it('ignores an automation pointed at an incompatible property', () => {
    const values = applyAutomations(
      {
        ...seedFormConfig(properties, titleName),
        automations: [{ kind: 'submittedAt', propertyId: 'desc', value: null }],
      },
      properties,
      {},
      context,
    )

    expect(values.desc).toBeUndefined()
  })
})

describe('buildSubmission', () => {
  const config = {
    ...seedFormConfig(properties, titleName),
    questions: [
      { propertyId: TITLE_QUESTION_ID, label: '', description: '', required: true, attachment: false, long: false },
      { propertyId: 'desc', label: '', description: '', required: true, attachment: false, long: true },
      { propertyId: 'severity', label: '', description: '', required: false, attachment: false, long: false },
      { propertyId: 'files', label: '', description: '', required: false, attachment: true, long: false },
    ],
  }

  it('names the row after the title answer and keeps the automations', () => {
    const result = buildSubmission(
      config,
      properties,
      {
        [TITLE_QUESTION_ID]: '  Floresta do professor  ',
        desc: 'Não abre',
        severity: ['high'],
        files: ['/api/uploads/u/a.png'],
      },
      titleName,
      context,
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.submission.title).toBe('Floresta do professor')
    expect(result.submission.values.desc).toBe('Não abre')
    expect(result.submission.values.severity).toEqual(['high'])
    expect(result.submission.values.files).toBe('/api/uploads/u/a.png')
    expect(result.submission.values.status).toBe('sent')
    expect(result.submission.values.who).toEqual(['user-1'])
  })

  it('reports every unanswered required question', () => {
    const result = buildSubmission(config, properties, {}, titleName, context)

    expect(result).toEqual({ ok: false, missing: [TITLE_QUESTION_ID, 'desc'] })
  })

  it('discards an option that does not belong to the property', () => {
    const result = buildSubmission(
      config,
      properties,
      { [TITLE_QUESTION_ID]: 'x', desc: 'y', severity: ['invented'] },
      titleName,
      context,
    )

    expect(result.ok && result.submission.values.severity).toEqual([])
  })

  it('refuses an attachment that did not come from an upload', () => {
    const result = buildSubmission(
      config,
      properties,
      {
        [TITLE_QUESTION_ID]: 'x',
        desc: 'y',
        files: ['https://evil.example/x.png'],
      },
      titleName,
      context,
    )

    expect(result.ok && result.submission.values.files).toBe('')
  })
})

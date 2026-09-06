import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'

import {
  type PropertyValue,
  type PropertyValues,
  type SelectOption,
  groupOf,
  isEmptyValue,
  normalizeValue,
  parseOptions,
} from './values'

export const TITLE_QUESTION_ID = 'title'

export const MAX_FORM_QUESTIONS = 60
export const MAX_FORM_AUTOMATIONS = 20
export const MAX_FORM_LABEL = 200
export const MAX_FORM_TEXT = 1_000
export const MAX_ROW_TITLE = 200

export const automationKinds = [
  'submittedAt',
  'submittedBy',
  'presetValue',
] as const

export type AutomationKind = (typeof automationKinds)[number]

export type FormQuestion = Readonly<{
  propertyId: string
  label: string
  description: string
  required: boolean
  attachment: boolean
  long: boolean
}>

export type FormAutomation = Readonly<{
  kind: AutomationKind
  propertyId: string
  value: PropertyValue
}>

export type FormConfig = Readonly<{
  headline: string
  intro: string
  submitLabel: string
  successMessage: string
  accepting: boolean
  notify: boolean
  questions: ReadonlyArray<FormQuestion>
  automations: ReadonlyArray<FormAutomation>
}>

export const emptyFormConfig: FormConfig = {
  headline: '',
  intro: '',
  submitLabel: '',
  successMessage: '',
  accepting: true,
  notify: true,
  questions: [],
  automations: [],
}

const filledByTheDatabase: ReadonlyArray<DatabasePropertyType> = [
  'person',
  'uniqueId',
]

export function isQuestionableType(type: DatabasePropertyType): boolean {
  return !filledByTheDatabase.includes(type)
}

export function automationAccepts(
  kind: AutomationKind,
  type: DatabasePropertyType,
): boolean {
  if (kind === 'submittedAt') {
    return type === 'date'
  }

  if (kind === 'submittedBy') {
    return type === 'person'
  }

  return !filledByTheDatabase.includes(type)
}

function trimTo(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function readQuestion(raw: unknown): FormQuestion | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const source = raw as Record<string, unknown>

  if (typeof source.propertyId !== 'string' || source.propertyId.length === 0) {
    return null
  }

  return {
    propertyId: source.propertyId,
    label: trimTo(source.label, MAX_FORM_LABEL),
    description: trimTo(source.description, MAX_FORM_TEXT),
    required: source.required === true,
    attachment: source.attachment === true,
    long: source.long === true,
  }
}

function readAutomation(raw: unknown): FormAutomation | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const source = raw as Record<string, unknown>

  if (
    typeof source.propertyId !== 'string' ||
    source.propertyId.length === 0 ||
    !automationKinds.includes(source.kind as AutomationKind)
  ) {
    return null
  }

  return {
    kind: source.kind as AutomationKind,
    propertyId: source.propertyId,
    value: (source.value ?? null) as PropertyValue,
  }
}

function uniqueByProperty<T extends { propertyId: string }>(
  items: ReadonlyArray<T>,
  max: number,
): Array<T> {
  const seen = new Set<string>()
  const kept: Array<T> = []

  for (const item of items) {
    if (seen.has(item.propertyId) || kept.length >= max) {
      continue
    }

    seen.add(item.propertyId)
    kept.push(item)
  }

  return kept
}

export function parseFormConfig(raw: unknown): FormConfig | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }

  const source = raw as Record<string, unknown>

  const questions = uniqueByProperty(
    (Array.isArray(source.questions) ? source.questions : []).flatMap(
      (item) => {
        const question = readQuestion(item)

        return question ? [question] : []
      },
    ),
    MAX_FORM_QUESTIONS,
  )

  const automations = (
    Array.isArray(source.automations) ? source.automations : []
  )
    .flatMap((item) => {
      const automation = readAutomation(item)

      return automation ? [automation] : []
    })
    .slice(0, MAX_FORM_AUTOMATIONS)

  return {
    headline: trimTo(source.headline, MAX_FORM_LABEL),
    intro: trimTo(source.intro, MAX_FORM_TEXT),
    submitLabel: trimTo(source.submitLabel, MAX_FORM_LABEL),
    successMessage: trimTo(source.successMessage, MAX_FORM_TEXT),
    accepting: source.accepting !== false,
    notify: source.notify !== false,
    questions,
    automations,
  }
}

export function serializeFormConfig(config: FormConfig) {
  return {
    headline: config.headline.slice(0, MAX_FORM_LABEL),
    intro: config.intro.slice(0, MAX_FORM_TEXT),
    submitLabel: config.submitLabel.slice(0, MAX_FORM_LABEL),
    successMessage: config.successMessage.slice(0, MAX_FORM_TEXT),
    accepting: config.accepting,
    notify: config.notify,
    questions: uniqueByProperty(config.questions, MAX_FORM_QUESTIONS),
    automations: config.automations.slice(0, MAX_FORM_AUTOMATIONS),
  }
}

type PropertyLike = Pick<DatabaseProperty, 'id' | 'name' | 'type' | 'options'>

export type ResolvedQuestion = Readonly<{
  propertyId: string
  name: string
  type: DatabasePropertyType
  options: ReadonlyArray<SelectOption>
  description: string
  required: boolean
  attachment: boolean
  long: boolean
}>

export const UPLOAD_PREFIX = '/api/uploads/'
export const MAX_ATTACHMENTS = 10

export function acceptsAttachment(type: DatabasePropertyType): boolean {
  return type === 'text' || type === 'files'
}

export function acceptsLongAnswer(type: DatabasePropertyType): boolean {
  return type === 'text'
}

export function attachmentLinks(value: unknown): Array<string> {
  const list = Array.isArray(value) ? value : []

  return list
    .filter(
      (item): item is string =>
        typeof item === 'string' && item.startsWith(UPLOAD_PREFIX),
    )
    .slice(0, MAX_ATTACHMENTS)
}

export function seedFormConfig(
  properties: ReadonlyArray<PropertyLike>,
  titleName: string,
): FormConfig {
  const questions: Array<FormQuestion> = [
    {
      propertyId: TITLE_QUESTION_ID,
      label: titleName,
      description: '',
      required: true,
      attachment: false,
      long: false,
    },
  ]

  const automations: Array<FormAutomation> = []

  for (const property of properties) {
    if (isQuestionableType(property.type)) {
      questions.push({
        propertyId: property.id,
        label: '',
        description: '',
        required: false,
        attachment: false,
        long: false,
      })
    }

    if (property.type === 'person') {
      automations.push({
        kind: 'submittedBy',
        propertyId: property.id,
        value: null,
      })

      continue
    }

    if (property.type === 'status') {
      const first = parseOptions(property.options).find(
        (option) => groupOf(option) === 'todo',
      )

      if (first) {
        automations.push({
          kind: 'presetValue',
          propertyId: property.id,
          value: first.id,
        })
      }
    }
  }

  return {
    ...emptyFormConfig,
    questions: questions.slice(0, MAX_FORM_QUESTIONS),
    automations: automations.slice(0, MAX_FORM_AUTOMATIONS),
  }
}

export function resolveQuestions(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  titleName: string,
): Array<ResolvedQuestion> {
  const byId = new Map(properties.map((property) => [property.id, property]))

  return config.questions.flatMap((question) => {
    if (question.propertyId === TITLE_QUESTION_ID) {
      return [
        {
          propertyId: TITLE_QUESTION_ID,
          name: question.label.length > 0 ? question.label : titleName,
          type: 'text' as DatabasePropertyType,
          options: [],
          description: question.description,
          required: question.required,
          attachment: false,
          long: false,
        },
      ]
    }

    const property = byId.get(question.propertyId)

    if (!property || !isQuestionableType(property.type)) {
      return []
    }

    return [
      {
        propertyId: property.id,
        name: question.label.length > 0 ? question.label : property.name,
        type: property.type,
        options: parseOptions(property.options),
        description: question.description,
        required: question.required,
        attachment:
          property.type === 'files' ||
          (question.attachment && acceptsAttachment(property.type)),
        long:
          question.long &&
          !question.attachment &&
          acceptsLongAnswer(property.type),
      },
    ]
  })
}

export type SubmissionContext = Readonly<{
  submittedOn: string
  submitterId: string | null
}>

export type Submission = Readonly<{
  title: string
  values: PropertyValues
}>

export type SubmissionResult =
  | { ok: true; submission: Submission }
  | { ok: false; missing: Array<string> }

export function applyAutomations(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  values: PropertyValues,
  context: SubmissionContext,
): PropertyValues {
  const byId = new Map(properties.map((property) => [property.id, property]))
  const next: Record<string, PropertyValue> = { ...values }

  for (const automation of config.automations) {
    const property = byId.get(automation.propertyId)

    if (!property || !automationAccepts(automation.kind, property.type)) {
      continue
    }

    if (automation.kind === 'submittedAt') {
      next[property.id] = context.submittedOn

      continue
    }

    if (automation.kind === 'submittedBy') {
      next[property.id] = context.submitterId ? [context.submitterId] : []

      continue
    }

    const current = next[property.id]

    if (current !== undefined && !isEmptyValue(current)) {
      continue
    }

    next[property.id] = normalizeValue(
      property.type,
      automation.value,
      parseOptions(property.options),
    )
  }

  return next
}

export function buildSubmission(
  config: FormConfig,
  properties: ReadonlyArray<PropertyLike>,
  answers: Readonly<Record<string, unknown>>,
  titleName: string,
  context: SubmissionContext,
): SubmissionResult {
  const questions = resolveQuestions(config, properties, titleName)
  const missing: Array<string> = []
  const values: Record<string, PropertyValue> = {}
  let title = ''

  for (const question of questions) {
    const answer = answers[question.propertyId]

    if (question.propertyId === TITLE_QUESTION_ID) {
      title =
        typeof answer === 'string' ? answer.trim().slice(0, MAX_ROW_TITLE) : ''

      if (question.required && title.length === 0) {
        missing.push(question.propertyId)
      }

      continue
    }

    const links = question.attachment ? attachmentLinks(answer) : []
    const value = question.attachment
      ? question.type === 'files'
        ? links
        : links.join('\n')
      : normalizeValue(question.type, answer, question.options)

    if (question.required && isEmptyValue(value)) {
      missing.push(question.propertyId)

      continue
    }

    values[question.propertyId] = value
  }

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return {
    ok: true,
    submission: {
      title,
      values: applyAutomations(config, properties, values, context),
    },
  }
}

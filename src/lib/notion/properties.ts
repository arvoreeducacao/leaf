import type { DatabasePropertyType } from '@/db/schema'
import type { NotionPropertyConfig } from '@/lib/notion/api'
import { plainText } from '@/lib/notion/api'
import type { OptionColor, SelectOption, StatusGroup } from '@/lib/database/values'
import { MAX_PROPERTIES, MAX_TEXT_VALUE } from '@/lib/database/values'

const colorByNotion: Record<string, OptionColor> = {
  blue: 'blue',
  brown: 'warning',
  default: 'gray',
  gray: 'gray',
  green: 'success',
  orange: 'orange',
  pink: 'primary',
  purple: 'purple',
  red: 'error',
  yellow: 'warning',
}

const groupByNotion: Record<string, StatusGroup> = {
  Complete: 'done',
  'In progress': 'doing',
  'To-do': 'todo',
}

const typeByNotion: Record<string, DatabasePropertyType> = {
  checkbox: 'checkbox',
  created_by: 'person',
  created_time: 'date',
  date: 'date',
  email: 'text',
  files: 'text',
  formula: 'text',
  last_edited_by: 'person',
  last_edited_time: 'date',
  multi_select: 'multiSelect',
  number: 'number',
  people: 'person',
  phone_number: 'text',
  relation: 'text',
  rich_text: 'text',
  rollup: 'text',
  select: 'select',
  status: 'status',
  unique_id: 'text',
  url: 'url',
}

export type ImportedProperty = Readonly<{
  notionName: string
  notionType: string
  name: string
  type: DatabasePropertyType
  options: Array<SelectOption>
}>

export type ImportedValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string>
  | Readonly<{ relation: ReadonlyArray<string> }>
  | null

export type PropertyResolver = Readonly<{
  personLabel: (id: string) => Promise<string | null>
  registerAsset: (url: string, name: string) => string | null
}>

function optionColor(value: unknown): OptionColor {
  return colorByNotion[typeof value === 'string' ? value : 'default'] ?? 'gray'
}

function selectOptions(config: unknown): Array<SelectOption> {
  if (!config || typeof config !== 'object') {
    return []
  }

  const options = (config as { options?: unknown }).options

  if (!Array.isArray(options)) {
    return []
  }

  return options.flatMap((option) => {
    if (!option || typeof option !== 'object') {
      return []
    }

    const candidate = option as { id?: unknown; name?: unknown; color?: unknown }

    if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
      return []
    }

    return [
      {
        color: optionColor(candidate.color),
        id: typeof candidate.id === 'string' ? candidate.id : candidate.name,
        name: candidate.name,
      },
    ]
  })
}

function statusOptions(config: unknown): Array<SelectOption> {
  const options = selectOptions(config)

  if (!config || typeof config !== 'object') {
    return options
  }

  const groups = (config as { groups?: unknown }).groups
  const groupByOptionId = new Map<string, StatusGroup>()

  if (Array.isArray(groups)) {
    for (const group of groups) {
      if (!group || typeof group !== 'object') {
        continue
      }

      const candidate = group as { name?: unknown; option_ids?: unknown }
      const mapped =
        typeof candidate.name === 'string'
          ? groupByNotion[candidate.name]
          : undefined

      if (!mapped || !Array.isArray(candidate.option_ids)) {
        continue
      }

      for (const id of candidate.option_ids) {
        if (typeof id === 'string') {
          groupByOptionId.set(id, mapped)
        }
      }
    }
  }

  return options.map((option) => ({
    ...option,
    group: groupByOptionId.get(option.id) ?? 'todo',
  }))
}

export function mapDatabaseProperties(
  configs: Record<string, NotionPropertyConfig>,
): Array<ImportedProperty> {
  const properties: Array<ImportedProperty> = []

  for (const [name, config] of Object.entries(configs)) {
    const notionType = config?.type ?? ''

    if (notionType === 'title') {
      continue
    }

    const type = typeByNotion[notionType]

    if (!type) {
      continue
    }

    const options =
      notionType === 'status'
        ? statusOptions(config[notionType])
        : notionType === 'select' || notionType === 'multi_select'
          ? selectOptions(config[notionType])
          : []

    properties.push({ name, notionName: name, notionType, options, type })
  }

  return properties.slice(0, MAX_PROPERTIES)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_VALUE) : ''
}

function optionName(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const name = (value as { name?: unknown }).name

  return typeof name === 'string' && name.length > 0 ? name : null
}

function dateStart(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const start = (value as { start?: unknown }).start

  return typeof start === 'string' && start.length >= 10
    ? start.slice(0, 10)
    : null
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 10
    ? value.slice(0, 10)
    : null
}

async function personLabels(
  value: unknown,
  resolver: PropertyResolver,
): Promise<Array<string>> {
  if (!Array.isArray(value)) {
    return []
  }

  const labels: Array<string> = []

  for (const person of value) {
    const id = (person as { id?: unknown })?.id

    if (typeof id !== 'string') {
      continue
    }

    const label = await resolver.personLabel(id)

    if (label) {
      labels.push(label)
    }
  }

  return labels
}

function fileLinks(value: unknown, resolver: PropertyResolver): string {
  if (!Array.isArray(value)) {
    return ''
  }

  const links: Array<string> = []

  for (const file of value) {
    if (!file || typeof file !== 'object') {
      continue
    }

    const candidate = file as {
      name?: unknown
      file?: { url?: unknown }
      external?: { url?: unknown }
    }
    const url =
      typeof candidate.file?.url === 'string'
        ? candidate.file.url
        : typeof candidate.external?.url === 'string'
          ? candidate.external.url
          : null

    if (!url) {
      continue
    }

    const name = typeof candidate.name === 'string' ? candidate.name : 'file'

    links.push(resolver.registerAsset(url, name) ?? url)
  }

  return links.join('\n').slice(0, MAX_TEXT_VALUE)
}

function formulaText(value: unknown): ImportedValue {
  if (!value || typeof value !== 'object') {
    return null
  }

  const formula = value as Record<string, unknown>

  switch (formula.type) {
    case 'string':
      return text(formula.string)

    case 'number':
      return typeof formula.number === 'number' ? String(formula.number) : ''

    case 'boolean':
      return formula.boolean === true ? 'true' : 'false'

    case 'date':
      return dateStart(formula.date) ?? ''

    default:
      return null
  }
}

function rollupText(value: unknown): ImportedValue {
  if (!value || typeof value !== 'object') {
    return null
  }

  const rollup = value as Record<string, unknown>

  switch (rollup.type) {
    case 'number':
      return typeof rollup.number === 'number' ? String(rollup.number) : ''

    case 'date':
      return dateStart(rollup.date) ?? ''

    case 'array':
      return Array.isArray(rollup.array)
        ? rollup.array
            .map((item) => {
              const entry = item as Record<string, unknown>

              if (entry?.type === 'title' || entry?.type === 'rich_text') {
                return plainText(entry[entry.type as string])
              }

              return optionName(entry?.[String(entry?.type)]) ?? ''
            })
            .filter((item) => item.length > 0)
            .join(', ')
            .slice(0, MAX_TEXT_VALUE)
        : ''

    default:
      return null
  }
}

function relationIds(value: unknown): ImportedValue {
  if (!Array.isArray(value)) {
    return null
  }

  const ids = value.flatMap((item) => {
    const id = (item as { id?: unknown })?.id

    return typeof id === 'string' ? [id] : []
  })

  return ids.length > 0 ? { relation: ids } : null
}

function uniqueIdText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const candidate = value as { prefix?: unknown; number?: unknown }

  if (typeof candidate.number !== 'number') {
    return ''
  }

  return typeof candidate.prefix === 'string' && candidate.prefix.length > 0
    ? `${candidate.prefix}-${candidate.number}`
    : String(candidate.number)
}

export async function importedValue(
  property: ImportedProperty,
  raw: unknown,
  resolver: PropertyResolver,
): Promise<ImportedValue> {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = (raw as Record<string, unknown>)[property.notionType]

  switch (property.notionType) {
    case 'rich_text':
      return text(plainText(value))

    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : null

    case 'select':
    case 'status':
      return optionName(value)

    case 'multi_select':
      return Array.isArray(value)
        ? value.flatMap((option) => {
            const name = optionName(option)

            return name ? [name] : []
          })
        : []

    case 'date':
      return dateStart(value)

    case 'people':
      return personLabels(value, resolver)

    case 'created_by':
    case 'last_edited_by':
      return personLabels(value ? [value] : [], resolver)

    case 'checkbox':
      return value === true

    case 'url':
    case 'email':
    case 'phone_number':
      return text(value)

    case 'files':
      return fileLinks(value, resolver)

    case 'formula':
      return formulaText(value)

    case 'rollup':
      return rollupText(value)

    case 'relation':
      return relationIds(value)

    case 'unique_id':
      return uniqueIdText(value)

    case 'created_time':
    case 'last_edited_time':
      return timestamp(value)

    default:
      return null
  }
}

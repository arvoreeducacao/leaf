import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { databaseProperties, databaseViews, documents } from '@/db/schema'
import type {
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseViewType,
  Document,
} from '@/db/schema'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import {
  reserveUniqueIdNumbers,
  seedUniqueIdProperty,
  unwrapUniqueIdProperty,
} from '@/lib/database/assign-unique-ids'
import { personOptions } from '@/lib/database/people'
import {
  MAX_PROPERTIES,
  MAX_PROPERTY_NAME,
  MAX_SELECT_OPTIONS,
  type PropertyValue,
  type SelectOption,
  colorForIndex,
  normalizeValue,
  parseOptions,
  parseValues,
  propertyTypes,
  serializeOptions,
  serializeValues,
  valueOf,
  valueToText,
} from '@/lib/database/values'
import {
  MAX_VIEWS,
  type FilterOperator,
  type ViewConfig,
  type ViewFilter,
  type ViewSort,
  applyFilters,
  applySearch,
  applySorts,
  emptyViewConfig,
  filterOperators,
  operatorNeedsValue,
  operatorsFor,
  parseViewConfig,
  serializeViewConfig,
  viewTypes,
} from '@/lib/database/views'
import type { DatabaseRow } from '@/lib/database/views'
import {
  listDatabaseProperties,
  loadDatabase,
} from '@/lib/databases'
import { getDocument } from '@/lib/documents'
import {
  MAX_MCP_RESULTS,
  MAX_MCP_TITLE_CHARS,
  type McpToolContext,
  McpToolError,
  blocksOf,
  clampLimit,
  documentUrl,
  requireDocumentId,
  requireReadable,
  requireWrite,
} from '@/lib/mcp/tools'
import { getMembership } from '@/lib/organizations'
import {
  type PropertyRefValues,
  findProperty,
  invalid,
  optionIdsFor,
  optionKinds,
  rosterFor,
  valuesFrom,
} from '@/lib/mcp/row-values'

export const MAX_MCP_ROW_TITLE_CHARS = 200

export const mcpViewTypes: ReadonlyArray<DatabaseViewType> = viewTypes.filter(
  (type) => type !== 'form',
)

type FilterInput = Readonly<{
  property: string
  operator: FilterOperator
  value?: unknown
}>

type SortInput = Readonly<{
  property: string
  direction?: 'asc' | 'desc'
}>

type ViewPatch = Readonly<{
  filters?: ReadonlyArray<FilterInput>
  sorts?: ReadonlyArray<SortInput>
  groupBy?: string | null
  hiddenProperties?: ReadonlyArray<string>
}>

async function searchIndex() {
  return import('@/lib/search-index')
}

function trimTitle(value: string | undefined, max: number) {
  return (value ?? '').trim().slice(0, max)
}

async function requireEditableDatabase(
  databaseId: string,
  context: McpToolContext,
): Promise<Document> {
  const id = requireDocumentId(databaseId)
  const access = await getDocumentAccess(id, context.session)

  if (!access) {
    throw new McpToolError('not_found', 'database not found')
  }

  if (!canEdit(access)) {
    throw new McpToolError('forbidden', 'cannot edit this database')
  }

  const document = await getDocument(id)

  if (!document || document.deletedAt || document.kind !== 'database') {
    throw new McpToolError('not_found', 'database not found')
  }

  return document
}

async function requireEditableRow(rowId: string, context: McpToolContext) {
  const id = requireDocumentId(rowId)
  const row = await getDocument(id)

  if (!row || row.deletedAt || row.kind !== 'row' || !row.parentId) {
    throw new McpToolError('not_found', 'row not found')
  }

  const database = await requireEditableDatabase(row.parentId, context)

  return { row, database }
}

function resolvedValues(
  row: DatabaseRow,
  properties: ReadonlyArray<DatabaseProperty>,
  people: ReadonlyArray<SelectOption>,
  locale: string,
) {
  const optionsByProperty = new Map(
    properties.map((property) => [
      property.id,
      property.type === 'person' ? people : parseOptions(property.options),
    ]),
  )

  return {
    values: Object.fromEntries(
      properties.map((property) => [
        property.name,
        valueToText(
          valueOf(row.values, property, optionsByProperty.get(property.id)),
          property.type,
          optionsByProperty.get(property.id) ?? [],
          locale,
        ),
      ]),
    ),
    rawValues: Object.fromEntries(
      properties.map((property) => [
        property.name,
        valueOf(row.values, property, optionsByProperty.get(property.id)),
      ]),
    ),
  }
}

function rowPayload(
  row: DatabaseRow,
  properties: ReadonlyArray<DatabaseProperty>,
  people: ReadonlyArray<SelectOption>,
  locale: string,
) {
  return {
    id: row.id,
    title: row.title,
    url: documentUrl(row.id),
    updatedAt: row.updatedAt,
    ...resolvedValues(row, properties, people, locale),
  }
}

async function filtersFrom(
  inputs: ReadonlyArray<FilterInput> | undefined,
  properties: ReadonlyArray<DatabaseProperty>,
  people: ReadonlyArray<SelectOption>,
): Promise<Array<ViewFilter>> {
  return (inputs ?? []).map((input) => {
    const property = findProperty(properties, input.property)

    if (!filterOperators.includes(input.operator)) {
      invalid(`unknown operator "${input.operator}"`)
    }

    if (!operatorsFor(property.type).includes(input.operator)) {
      invalid(
        `operator "${input.operator}" does not apply to "${property.name}" (${property.type})`,
      )
    }

    if (!operatorNeedsValue(input.operator)) {
      return { propertyId: property.id, operator: input.operator, value: null }
    }

    const options = parseOptions(property.options)
    const value: PropertyValue =
      property.type === 'person'
        ? normalizeValue('person', input.value, people)
        : optionKinds.includes(property.type)
          ? optionIdsFor(property, options, input.value)
          : normalizeValue(property.type, input.value, options)

    return { propertyId: property.id, operator: input.operator, value }
  })
}

function sortsFrom(
  inputs: ReadonlyArray<SortInput> | undefined,
  properties: ReadonlyArray<DatabaseProperty>,
): Array<ViewSort> {
  return (inputs ?? []).map((input) => ({
    propertyId: findProperty(properties, input.property).id,
    direction: input.direction ?? 'asc',
  }))
}

export async function queryDatabaseTool(
  context: McpToolContext,
  args: Readonly<{
    databaseId: string
    filters?: ReadonlyArray<FilterInput>
    sorts?: ReadonlyArray<SortInput>
    search?: string
    limit?: number
    offset?: number
  }>,
) {
  const { document } = await requireReadable(args.databaseId, context)

  if (document.kind !== 'database') {
    throw new McpToolError('not_found', 'database not found')
  }

  const snapshot = await loadDatabase(document.id, context.session.user.id)

  if (!snapshot) {
    throw new McpToolError('not_found', 'database not found')
  }

  const people = personOptions(snapshot.people)
  const filters = await filtersFrom(args.filters, snapshot.properties, people)
  const sorts = sortsFrom(args.sorts, snapshot.properties)
  const locale = context.locale ?? 'pt-BR'
  const limit = clampLimit(args.limit, MAX_MCP_RESULTS)
  const offset = Math.max(0, Math.trunc(args.offset ?? 0))

  let rows = applyFilters(
    snapshot.rows,
    filters,
    snapshot.properties,
    context.session.user.id,
    people,
  )

  if (args.search && args.search.trim().length > 0) {
    rows = applySearch(rows, args.search, snapshot.properties, people)
  }

  rows = applySorts(rows, sorts, snapshot.properties, people)

  return {
    id: snapshot.id,
    title: snapshot.title,
    url: documentUrl(snapshot.id),
    total: rows.length,
    offset,
    rows: rows
      .slice(offset, offset + limit)
      .map((row) => rowPayload(row, snapshot.properties, people, locale)),
  }
}

export async function createDatabaseRowTool(
  context: McpToolContext,
  args: Readonly<{
    databaseId: string
    title?: string
    values?: PropertyRefValues
    markdown?: string
    html?: string
  }>,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const properties = await listDatabaseProperties(database.id)
  const userId = context.session.user.id
  const values = await valuesFrom(
    args.values,
    properties,
    database.orgId,
    userId,
  )

  for (const property of properties) {
    if (property.type === 'uniqueId') {
      const [number] = await reserveUniqueIdNumbers(property.id, 1)

      if (number !== undefined) {
        values[property.id] = number
      }
    }
  }

  const blocks = await blocksOf(args, false)
  const title = trimTitle(args.title, MAX_MCP_ROW_TITLE_CHARS)
  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: database.ownerId,
    parentId: database.id,
    orgId: database.orgId,
    teamspaceId: database.teamspaceId,
    orgAccess: database.orgAccess,
    kind: 'row',
    title,
    content: blocks.length > 0 ? JSON.stringify(blocks) : null,
    properties: serializeValues(values),
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(documents)
    .set({ updatedAt: now })
    .where(eq(documents.id, database.id))

  const { indexDocument } = await searchIndex()

  await indexDocument(id)
  context.onDocumentWritten?.(id)

  const people = await rosterFor(database.orgId, userId)
  const row: DatabaseRow = {
    id,
    title,
    icon: null,
    cover: null,
    preview: null,
    values,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    databaseId: database.id,
    ...rowPayload(row, properties, people, context.locale ?? 'pt-BR'),
  }
}

export async function updateDatabaseRowTool(
  context: McpToolContext,
  args: Readonly<{
    rowId: string
    title?: string
    values?: PropertyRefValues
  }>,
) {
  requireWrite(context)

  const { row, database } = await requireEditableRow(args.rowId, context)
  const properties = await listDatabaseProperties(database.id)
  const userId = context.session.user.id
  const incoming = await valuesFrom(
    args.values,
    properties,
    database.orgId,
    userId,
  )

  if (args.title === undefined && Object.keys(incoming).length === 0) {
    invalid('send a title or at least one value')
  }

  const values = { ...parseValues(row.properties), ...incoming }
  const title =
    args.title === undefined
      ? row.title
      : trimTitle(args.title, MAX_MCP_ROW_TITLE_CHARS)
  const now = new Date()

  await db
    .update(documents)
    .set({ properties: serializeValues(values), title, updatedAt: now })
    .where(eq(documents.id, row.id))

  if (title !== row.title) {
    const { indexDocument } = await searchIndex()

    await indexDocument(row.id)
  }

  context.onDocumentWritten?.(row.id)

  const people = await rosterFor(database.orgId, userId)
  const updated: DatabaseRow = {
    id: row.id,
    title,
    icon: row.icon,
    cover: row.cover,
    preview: null,
    values,
    createdAt: row.createdAt.toISOString(),
    updatedAt: now.toISOString(),
  }

  return {
    databaseId: database.id,
    ...rowPayload(updated, properties, people, context.locale ?? 'pt-BR'),
  }
}

export async function deleteDatabaseRowTool(
  context: McpToolContext,
  args: Readonly<{ rowId: string }>,
) {
  requireWrite(context)

  const { row, database } = await requireEditableRow(args.rowId, context)
  const descendants = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.parentId, row.id))
  const ids = [row.id, ...descendants.map((item) => item.id)]

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(inArray(documents.id, ids), isNull(documents.deletedAt)))

  const { removeDocumentFromIndex } = await searchIndex()

  for (const id of ids) {
    await removeDocumentFromIndex(id)
  }

  context.onDocumentWritten?.(database.id)

  return { id: row.id, databaseId: database.id, trashed: true }
}

type PropertyInput = Readonly<{
  name: string
  type: string
  options?: ReadonlyArray<string>
}>

function requirePropertyType(type: string): DatabasePropertyType {
  if (!propertyTypes.includes(type as DatabasePropertyType)) {
    invalid(`unknown property type "${type}"; available: ${propertyTypes.join(', ')}`)
  }

  return type as DatabasePropertyType
}

function requirePropertyName(name: string) {
  const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)

  if (trimmed.length === 0) {
    invalid('property name is required')
  }

  return trimmed
}

function optionsFor(
  type: DatabasePropertyType,
  names: ReadonlyArray<string> | undefined,
  existing: ReadonlyArray<SelectOption> = [],
): Array<SelectOption> {
  if (!names || names.length === 0) {
    return [...existing]
  }

  if (!optionKinds.includes(type)) {
    invalid(`options only apply to select, multiSelect and status`)
  }

  const result = [...existing]

  for (const raw of names) {
    const name = raw.trim().slice(0, MAX_PROPERTY_NAME)

    if (name.length === 0) {
      continue
    }

    if (result.some((option) => option.name.toLowerCase() === name.toLowerCase())) {
      continue
    }

    if (result.length >= MAX_SELECT_OPTIONS) {
      invalid(`a property holds at most ${MAX_SELECT_OPTIONS} options`)
    }

    result.push(
      type === 'status'
        ? { id: nanoid(8), name, color: colorForIndex(result.length), group: 'todo' }
        : { id: nanoid(8), name, color: colorForIndex(result.length) },
    )
  }

  return result
}

function propertyPayload(property: DatabaseProperty) {
  return {
    id: property.id,
    name: property.name,
    type: property.type,
    options: parseOptions(property.options).map((option) => option.name),
  }
}

function viewName(context: McpToolContext, type: DatabaseViewType) {
  const portuguese = (context.locale ?? 'pt-BR').toLowerCase().startsWith('pt')
  const names: Record<string, [string, string]> = {
    table: ['Tabela', 'Table'],
    board: ['Quadro', 'Board'],
    gallery: ['Galeria', 'Gallery'],
    calendar: ['Calendário', 'Calendar'],
    list: ['Lista', 'List'],
    timeline: ['Linha do tempo', 'Timeline'],
  }
  const pair = names[type] ?? [type, type]

  return portuguese ? pair[0] : pair[1]
}

export async function createDatabaseTool(
  context: McpToolContext,
  args: Readonly<{
    title: string
    parentId?: string
    properties?: ReadonlyArray<PropertyInput>
  }>,
) {
  requireWrite(context)

  const title = trimTitle(args.title, MAX_MCP_TITLE_CHARS)

  if (title.length === 0) {
    invalid('title is required')
  }

  if ((args.properties?.length ?? 0) > MAX_PROPERTIES) {
    invalid(`a database holds at most ${MAX_PROPERTIES} properties`)
  }

  const userId = context.session.user.id
  let parent: Document | null = null

  if (args.parentId !== undefined) {
    const parentId = requireDocumentId(args.parentId)
    const access = await getDocumentAccess(parentId, context.session)

    if (!canEdit(access)) {
      throw new McpToolError('forbidden', 'cannot create inside this document')
    }

    parent = await getDocument(parentId)

    if (!parent || parent.deletedAt || parent.kind !== 'page') {
      invalid('parent must be a page')
    }
  }

  const membership = parent ? null : await getMembership(userId)
  const orgId = parent ? parent.orgId : (membership?.orgId ?? null)
  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: userId,
    parentId: parent?.id ?? null,
    orgId,
    teamspaceId: parent?.teamspaceId ?? null,
    orgAccess: parent?.orgAccess ?? null,
    kind: 'database',
    title,
    createdAt: now,
    updatedAt: now,
  })

  const created: Array<DatabaseProperty> = []

  for (const [position, input] of (args.properties ?? []).entries()) {
    const type = requirePropertyType(input.type)

    if (type === 'person' && !orgId) {
      invalid('person properties need the database inside an organization')
    }

    const options = optionsFor(type, input.options)
    const property = {
      id: nanoid(12),
      databaseId: id,
      name: requirePropertyName(input.name),
      type,
      options: options.length > 0 ? serializeOptions(options) : null,
      position,
      createdAt: now,
    }

    await db.insert(databaseProperties).values(property)
    created.push(property as DatabaseProperty)

    if (type === 'uniqueId') {
      await seedUniqueIdProperty(id, property.id)
    }
  }

  const viewId = nanoid(12)

  await db.insert(databaseViews).values({
    id: viewId,
    databaseId: id,
    name: viewName(context, 'table'),
    type: 'table',
    config: serializeViewConfig(emptyViewConfig),
    position: 0,
    createdAt: now,
  })

  const { indexDocument } = await searchIndex()

  await indexDocument(id)
  context.onDocumentWritten?.(id)

  return {
    id,
    title,
    parentId: parent?.id ?? null,
    url: documentUrl(id),
    properties: created.map(propertyPayload),
    views: [{ id: viewId, name: viewName(context, 'table'), type: 'table' }],
  }
}

export async function addDatabasePropertyTool(
  context: McpToolContext,
  args: Readonly<{
    databaseId: string
    name: string
    type: string
    options?: ReadonlyArray<string>
  }>,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const type = requirePropertyType(args.type)
  const name = requirePropertyName(args.name)

  if (type === 'person' && !database.orgId) {
    invalid('person properties need the database inside an organization')
  }

  const existing = await listDatabaseProperties(database.id)

  if (existing.length >= MAX_PROPERTIES) {
    invalid(`a database holds at most ${MAX_PROPERTIES} properties`)
  }

  if (existing.some((property) => property.name.toLowerCase() === name.toLowerCase())) {
    invalid(`a property named "${name}" already exists`)
  }

  const options = optionsFor(type, args.options)
  const property = {
    id: nanoid(12),
    databaseId: database.id,
    name,
    type,
    options: options.length > 0 ? serializeOptions(options) : null,
    position: existing.length,
    createdAt: new Date(),
  }

  await db.insert(databaseProperties).values(property)

  if (type === 'uniqueId') {
    await seedUniqueIdProperty(database.id, property.id)
  }

  context.onDocumentWritten?.(database.id)

  return { databaseId: database.id, property: propertyPayload(property as DatabaseProperty) }
}

export async function updateDatabasePropertyTool(
  context: McpToolContext,
  args: Readonly<{
    databaseId: string
    property: string
    name?: string
    type?: string
    addOptions?: ReadonlyArray<string>
  }>,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const properties = await listDatabaseProperties(database.id)
  const property = findProperty(properties, args.property)

  if (
    args.name === undefined &&
    args.type === undefined &&
    (args.addOptions?.length ?? 0) === 0
  ) {
    invalid('send a name, a type or options to add')
  }

  const changes: {
    name?: string
    type?: DatabasePropertyType
    options?: string | null
  } = {}

  if (args.name !== undefined) {
    const name = requirePropertyName(args.name)

    if (
      properties.some(
        (other) =>
          other.id !== property.id &&
          other.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      invalid(`a property named "${name}" already exists`)
    }

    changes.name = name
  }

  let nextType = property.type

  if (args.type !== undefined) {
    const type = requirePropertyType(args.type)

    if (type !== property.type) {
      if (type === 'person' && !database.orgId) {
        invalid('person properties need the database inside an organization')
      }

      const keepsOptions =
        optionKinds.includes(type) && optionKinds.includes(property.type)

      if (property.type === 'uniqueId') {
        await unwrapUniqueIdProperty(database.id, property, type)
      }

      changes.type = type
      changes.options = keepsOptions ? property.options : null
      nextType = type
    }
  }

  if (args.addOptions && args.addOptions.length > 0) {
    const current =
      changes.options === undefined
        ? parseOptions(property.options)
        : parseOptions(changes.options)
    const merged = optionsFor(nextType, args.addOptions, current)

    changes.options = serializeOptions(merged)
  }

  await db
    .update(databaseProperties)
    .set(changes)
    .where(eq(databaseProperties.id, property.id))

  if (changes.type === 'uniqueId') {
    await seedUniqueIdProperty(database.id, property.id, [property])
  }

  const refreshed = (await listDatabaseProperties(database.id)).find(
    (item) => item.id === property.id,
  )

  context.onDocumentWritten?.(database.id)

  return {
    databaseId: database.id,
    property: propertyPayload(refreshed ?? property),
  }
}

export async function deleteDatabasePropertyTool(
  context: McpToolContext,
  args: Readonly<{ databaseId: string; property: string }>,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const properties = await listDatabaseProperties(database.id)
  const property = findProperty(properties, args.property)

  await db.delete(databaseProperties).where(eq(databaseProperties.id, property.id))

  const remaining = await listDatabaseProperties(database.id)

  for (const [index, item] of remaining.entries()) {
    if (item.position !== index) {
      await db
        .update(databaseProperties)
        .set({ position: index })
        .where(eq(databaseProperties.id, item.id))
    }
  }

  context.onDocumentWritten?.(database.id)

  return {
    databaseId: database.id,
    deleted: { id: property.id, name: property.name },
    properties: remaining.map(propertyPayload),
  }
}

function requireViewType(type: string): DatabaseViewType {
  if (!mcpViewTypes.includes(type as DatabaseViewType)) {
    invalid(`unknown view type "${type}"; available: ${mcpViewTypes.join(', ')}`)
  }

  return type as DatabaseViewType
}

async function configFrom(
  base: ViewConfig,
  patch: ViewPatch,
  properties: ReadonlyArray<DatabaseProperty>,
  people: ReadonlyArray<SelectOption>,
): Promise<ViewConfig> {
  const next: {
    -readonly [K in keyof ViewConfig]: ViewConfig[K]
  } = { ...base }

  if (patch.filters !== undefined) {
    next.filters = await filtersFrom(patch.filters, properties, people)
  }

  if (patch.sorts !== undefined) {
    next.sorts = sortsFrom(patch.sorts, properties)
  }

  if (patch.groupBy !== undefined) {
    next.groupByPropertyId =
      patch.groupBy === null ? null : findProperty(properties, patch.groupBy).id
  }

  if (patch.hiddenProperties !== undefined) {
    next.hiddenPropertyIds = patch.hiddenProperties.map(
      (reference) => findProperty(properties, reference).id,
    )
  }

  return parseViewConfig(serializeViewConfig(next))
}

function viewPayload(
  view: { id: string; name: string; type: DatabaseViewType; config: string | null },
  properties: ReadonlyArray<DatabaseProperty>,
) {
  const config = parseViewConfig(view.config)
  const nameOf = (id: string | null) =>
    properties.find((property) => property.id === id)?.name ?? null

  return {
    id: view.id,
    name: view.name,
    type: view.type,
    groupBy: nameOf(config.groupByPropertyId),
    filters: config.filters.map((filter) => ({
      property: nameOf(filter.propertyId),
      operator: filter.operator,
      value: filter.value,
    })),
    sorts: config.sorts.map((sort) => ({
      property: nameOf(sort.propertyId),
      direction: sort.direction,
    })),
    hiddenProperties: config.hiddenPropertyIds.map(nameOf),
  }
}

export async function createDatabaseViewTool(
  context: McpToolContext,
  args: Readonly<{ databaseId: string; name?: string; type: string }> & ViewPatch,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const type = requireViewType(args.type)
  const existing = await db
    .select({ id: databaseViews.id })
    .from(databaseViews)
    .where(eq(databaseViews.databaseId, database.id))
    .orderBy(asc(databaseViews.position))

  if (existing.length >= MAX_VIEWS) {
    invalid(`a database holds at most ${MAX_VIEWS} views`)
  }

  const properties = await listDatabaseProperties(database.id)
  const people = await rosterFor(database.orgId, context.session.user.id)
  const config = await configFrom(emptyViewConfig, args, properties, people)
  const name = trimTitle(args.name, MAX_PROPERTY_NAME) || viewName(context, type)
  const view = {
    id: nanoid(12),
    databaseId: database.id,
    name,
    type,
    config: serializeViewConfig(config),
    position: existing.length,
    createdAt: new Date(),
  }

  await db.insert(databaseViews).values(view)
  context.onDocumentWritten?.(database.id)

  return { databaseId: database.id, view: viewPayload(view, properties) }
}

export async function updateDatabaseViewTool(
  context: McpToolContext,
  args: Readonly<{
    databaseId: string
    viewId: string
    name?: string
    type?: string
  }> &
    ViewPatch,
) {
  requireWrite(context)

  const database = await requireEditableDatabase(args.databaseId, context)
  const view = await db.query.databaseViews.findFirst({
    where: and(
      eq(databaseViews.id, args.viewId),
      eq(databaseViews.databaseId, database.id),
    ),
  })

  if (!view) {
    throw new McpToolError('not_found', 'view not found')
  }

  const properties = await listDatabaseProperties(database.id)
  const people = await rosterFor(database.orgId, context.session.user.id)
  const changes: { name?: string; type?: DatabaseViewType; config?: string } = {}

  if (args.name !== undefined) {
    changes.name = requirePropertyName(args.name)
  }

  if (args.type !== undefined) {
    changes.type = requireViewType(args.type)
  }

  if (
    args.filters !== undefined ||
    args.sorts !== undefined ||
    args.groupBy !== undefined ||
    args.hiddenProperties !== undefined
  ) {
    changes.config = serializeViewConfig(
      await configFrom(parseViewConfig(view.config), args, properties, people),
    )
  }

  if (Object.keys(changes).length === 0) {
    invalid('send a name, a type, filters, sorts, groupBy or hiddenProperties')
  }

  await db.update(databaseViews).set(changes).where(eq(databaseViews.id, view.id))
  context.onDocumentWritten?.(database.id)

  return {
    databaseId: database.id,
    view: viewPayload({ ...view, ...changes }, properties),
  }
}

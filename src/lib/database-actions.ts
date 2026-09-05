'use server'

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViewDrafts,
  databaseViews,
  documents,
} from '@/db/schema'
import type {
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseViewType,
} from '@/db/schema'
import { getActiveMembership } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import {
  reserveUniqueIdNumbers,
  seedUniqueIdProperty,
  unwrapUniqueIdProperty,
} from '@/lib/database/assign-unique-ids'
import { personOptions } from '@/lib/database/people'
import {
  MAX_UNIQUE_ID_PREFIX,
  type PropertyRefresh,
  normalizeUniqueIdPrefix,
  parseUniqueIdConfig,
  serializeUniqueIdConfig,
} from '@/lib/database/unique-id'
import {
  MAX_PROPERTIES,
  MAX_PROPERTY_NAME,
  MAX_SELECT_OPTIONS,
  type SelectOption,
  colorForIndex,
  normalizeValue,
  parseOptions,
  parseValues,
  propertyTypes,
  serializeOptions,
  serializeValues,
} from '@/lib/database/values'
import {
  MAX_VIEWS,
  type ViewConfig,
  parseViewConfig,
  serializeViewConfig,
  viewTypes,
} from '@/lib/database/views'
import type { DatabaseRow } from '@/lib/database/views'
import {
  getDatabaseDocument,
  listDatabasePeople,
  listDatabaseProperties,
  toDatabaseRow,
} from '@/lib/databases'
import { indexDocument, removeDocumentFromIndex } from '@/lib/search-index'

export type DatabaseActionResult = { ok: true } | { ok: false; error: string }

async function notAllowed(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: (await getTranslations('errors'))('notAllowed') }
}

async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

async function databaseIdOfProperty(propertyId: string) {
  const property = await db.query.databaseProperties.findFirst({
    where: eq(databaseProperties.id, propertyId),
  })

  return property ?? null
}

async function databaseIdOfView(viewId: string) {
  const view = await db.query.databaseViews.findFirst({
    where: eq(databaseViews.id, viewId),
  })

  return view ?? null
}

async function canEditDatabase(databaseId: string) {
  const session = await requireSession()
  const access = await getDocumentAccess(databaseId, session)

  return canEdit(access) ? session : null
}

function untitledRow(title: string) {
  return title.trim().slice(0, 200)
}

export async function createDatabase(
  parentId: string | null = null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSession()

  if (parentId) {
    const parentAccess = await getDocumentAccess(parentId, session)

    if (!canEdit(parentAccess)) {
      return notAllowed()
    }
  }

  const parent = parentId
    ? await db.query.documents.findFirst({ where: eq(documents.id, parentId) })
    : null

  const membership = await getActiveMembership(session.user.id)
  const t = await getTranslations('database')
  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: session.user.id,
    parentId: parent?.id ?? null,
    orgId: parent ? parent.orgId : (membership?.orgId ?? null),
    teamspaceId: parent?.teamspaceId ?? null,
    orgAccess: parent?.orgAccess ?? null,
    kind: 'database',
    title: t('untitled'),
    createdAt: now,
    updatedAt: now,
  })

  const statusOptions: Array<SelectOption> = [
    { id: nanoid(8), name: t('defaultStatusTodo'), color: colorForIndex(0) },
    { id: nanoid(8), name: t('defaultStatusDoing'), color: colorForIndex(2) },
    { id: nanoid(8), name: t('defaultStatusDone'), color: colorForIndex(8) },
  ]

  const statusId = nanoid(12)

  await db.insert(databaseProperties).values([
    {
      id: statusId,
      databaseId: id,
      name: t('defaultStatus'),
      type: 'select',
      options: serializeOptions(statusOptions),
      position: 0,
      createdAt: now,
    },
    {
      id: nanoid(12),
      databaseId: id,
      name: t('defaultDate'),
      type: 'date',
      options: null,
      position: 1,
      createdAt: now,
    },
  ])

  await db.insert(databaseViews).values([
    {
      id: nanoid(12),
      databaseId: id,
      name: t('defaultTableView'),
      type: 'table',
      config: serializeViewConfig({
        groupByPropertyId: statusId,
        filters: [],
        sorts: [],
        hiddenPropertyIds: [],
      }),
      position: 0,
      createdAt: now,
    },
  ])

  await indexDocument(id)
  revalidatePath('/', 'layout')

  return { ok: true, id }
}

export async function createDatabasePage() {
  const result = await createDatabase(null)

  if (!result.ok) {
    return result
  }

  redirect(`/doc/${result.id}`)
}

export async function addDatabaseProperty(
  databaseId: string,
  type: DatabasePropertyType,
  name: string,
): Promise<
  | { ok: true; id: string; refresh: PropertyRefresh | null }
  | { ok: false; error: string }
> {
  if (!(await canEditDatabase(databaseId))) {
    return notAllowed()
  }

  if (!propertyTypes.includes(type)) {
    return notAllowed()
  }

  if (type === 'person' && !(await getDatabaseDocument(databaseId))?.orgId) {
    return {
      ok: false,
      error: (await getTranslations('database'))('personNeedsOrganization'),
    }
  }

  const existing = await listDatabaseProperties(databaseId)

  if (existing.length >= MAX_PROPERTIES) {
    return {
      ok: false,
      error: (await getTranslations('database'))('tooManyProperties', {
        max: MAX_PROPERTIES,
      }),
    }
  }

  const t = await getTranslations('database')
  const id = nanoid(12)
  const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)

  await db.insert(databaseProperties).values({
    id,
    databaseId,
    name: trimmed.length > 0 ? trimmed : t(`type_${type}`),
    type,
    options: null,
    position: existing.length,
    createdAt: new Date(),
  })

  const refresh =
    type === 'uniqueId' ? await seedUniqueIdProperty(databaseId, id) : null

  revalidatePath(`/doc/${databaseId}`)

  return { ok: true, id, refresh }
}

export async function renameDatabaseProperty(
  propertyId: string,
  name: string,
): Promise<DatabaseActionResult> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)

  if (trimmed.length === 0) {
    return notAllowed()
  }

  await db
    .update(databaseProperties)
    .set({ name: trimmed })
    .where(eq(databaseProperties.id, propertyId))

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true }
}

export async function changeDatabasePropertyType(
  propertyId: string,
  type: DatabasePropertyType,
): Promise<
  { ok: true; refresh: PropertyRefresh | null } | { ok: false; error: string }
> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  if (!propertyTypes.includes(type) || property.type === type) {
    return notAllowed()
  }

  const optionKinds: ReadonlyArray<DatabasePropertyType> = [
    'select',
    'multiSelect',
    'status',
  ]
  const keepsOptions =
    optionKinds.includes(type) && optionKinds.includes(property.type)

  const unwrapped =
    property.type === 'uniqueId'
      ? await unwrapUniqueIdProperty(property.databaseId, property, type)
      : null

  await db
    .update(databaseProperties)
    .set({ type, options: keepsOptions ? property.options : null })
    .where(eq(databaseProperties.id, propertyId))

  const refresh =
    type === 'uniqueId'
      ? await seedUniqueIdProperty(property.databaseId, propertyId, [property])
      : unwrapped

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true, refresh }
}

export async function setDatabaseUniqueIdPrefix(
  propertyId: string,
  prefix: string,
): Promise<DatabaseActionResult> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  if (property.type !== 'uniqueId') {
    return notAllowed()
  }

  const config = parseUniqueIdConfig(property.options)

  await db
    .update(databaseProperties)
    .set({
      options: serializeUniqueIdConfig({
        prefix: normalizeUniqueIdPrefix(prefix.slice(0, MAX_UNIQUE_ID_PREFIX)),
        next: config.next,
      }),
    })
    .where(eq(databaseProperties.id, propertyId))

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true }
}

export async function deleteDatabaseProperty(
  propertyId: string,
): Promise<DatabaseActionResult> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  await db
    .delete(databaseProperties)
    .where(eq(databaseProperties.id, propertyId))

  const remaining = await listDatabaseProperties(property.databaseId)

  for (const [index, item] of remaining.entries()) {
    if (item.position !== index) {
      await db
        .update(databaseProperties)
        .set({ position: index })
        .where(eq(databaseProperties.id, item.id))
    }
  }

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true }
}

export async function addSelectOption(
  propertyId: string,
  name: string,
): Promise<{ ok: true; option: SelectOption } | { ok: false; error: string }> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  if (
    property.type !== 'select' &&
    property.type !== 'multiSelect' &&
    property.type !== 'status'
  ) {
    return notAllowed()
  }

  const options = parseOptions(property.options)
  const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)

  if (trimmed.length === 0 || options.length >= MAX_SELECT_OPTIONS) {
    return notAllowed()
  }

  const existing = options.find(
    (option) => option.name.toLowerCase() === trimmed.toLowerCase(),
  )

  if (existing) {
    return { ok: true, option: existing }
  }

  const option: SelectOption =
    property.type === 'status'
      ? {
          id: nanoid(8),
          name: trimmed,
          color: colorForIndex(options.length),
          group: 'todo',
        }
      : {
          id: nanoid(8),
          name: trimmed,
          color: colorForIndex(options.length),
        }

  await db
    .update(databaseProperties)
    .set({ options: serializeOptions([...options, option]) })
    .where(eq(databaseProperties.id, propertyId))

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true, option }
}

export async function deleteSelectOption(
  propertyId: string,
  optionId: string,
): Promise<DatabaseActionResult> {
  const property = await databaseIdOfProperty(propertyId)

  if (!property || !(await canEditDatabase(property.databaseId))) {
    return notAllowed()
  }

  const options = parseOptions(property.options).filter(
    (option) => option.id !== optionId,
  )

  await db
    .update(databaseProperties)
    .set({ options: serializeOptions(options) })
    .where(eq(databaseProperties.id, propertyId))

  revalidatePath(`/doc/${property.databaseId}`)

  return { ok: true }
}

async function normalizeForProperty(
  property: Pick<DatabaseProperty, 'type' | 'options'>,
  value: unknown,
  orgId: string | null,
  viewerId: string,
): Promise<ReturnType<typeof normalizeValue>> {
  if (property.type !== 'person') {
    return normalizeValue(property.type, value, parseOptions(property.options))
  }

  if (!orgId) {
    return []
  }

  const roster = personOptions(await listDatabasePeople(orgId, viewerId))

  return roster.length === 0
    ? []
    : normalizeValue('person', value, roster)
}

export type RowResult =
  | { ok: true; row: DatabaseRow }
  | { ok: false; error: string }

export async function createDatabaseRow(
  databaseId: string,
  seed: Readonly<Record<string, unknown>> = {},
  title = '',
): Promise<RowResult> {
  const session = await canEditDatabase(databaseId)

  if (!session) {
    return notAllowed()
  }

  const database = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, databaseId),
      eq(documents.kind, 'database'),
      isNull(documents.deletedAt),
    ),
  })

  if (!database) {
    return notAllowed()
  }

  const properties = await listDatabaseProperties(databaseId)
  const values: Record<string, ReturnType<typeof normalizeValue>> = {}

  for (const property of properties) {
    if (property.type === 'uniqueId') {
      const [number] = await reserveUniqueIdNumbers(property.id, 1)

      if (number !== undefined) {
        values[property.id] = number
      }

      continue
    }

    const raw = seed[property.id]

    if (raw === undefined) {
      continue
    }

    values[property.id] = await normalizeForProperty(
      property,
      raw,
      database.orgId,
      session.user.id,
    )
  }

  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: database.ownerId,
    parentId: databaseId,
    orgId: database.orgId,
    teamspaceId: database.teamspaceId,
    orgAccess: database.orgAccess,
    kind: 'row',
    title: untitledRow(title),
    properties: serializeValues(values),
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(documents)
    .set({ updatedAt: now })
    .where(eq(documents.id, databaseId))

  await indexDocument(id)
  revalidatePath(`/doc/${databaseId}`)

  return {
    ok: true,
    row: toDatabaseRow({
      id,
      title: untitledRow(title),
      icon: null,
      cover: null,
      properties: serializeValues(values),
      createdAt: now,
      updatedAt: now,
    }),
  }
}

export async function setDatabaseRowValue(
  rowId: string,
  propertyId: string,
  value: unknown,
): Promise<DatabaseActionResult> {
  const row = await db.query.documents.findFirst({
    where: and(eq(documents.id, rowId), eq(documents.kind, 'row')),
  })

  if (!row || !row.parentId || row.deletedAt !== null) {
    return notAllowed()
  }

  const session = await canEditDatabase(row.parentId)

  if (!session) {
    return notAllowed()
  }

  const property = await db.query.databaseProperties.findFirst({
    where: and(
      eq(databaseProperties.id, propertyId),
      eq(databaseProperties.databaseId, row.parentId),
    ),
  })

  if (!property || property.type === 'uniqueId') {
    return notAllowed()
  }

  const values = {
    ...parseValues(row.properties),
    [propertyId]: await normalizeForProperty(
      property,
      value,
      row.orgId,
      session.user.id,
    ),
  }

  await db
    .update(documents)
    .set({ properties: serializeValues(values), updatedAt: new Date() })
    .where(eq(documents.id, rowId))

  revalidatePath(`/doc/${row.parentId}`)
  revalidatePath(`/doc/${rowId}`)

  return { ok: true }
}

export async function renameDatabaseRow(
  rowId: string,
  title: string,
): Promise<DatabaseActionResult> {
  const row = await db.query.documents.findFirst({
    where: and(eq(documents.id, rowId), eq(documents.kind, 'row')),
  })

  if (!row || !row.parentId || !(await canEditDatabase(row.parentId))) {
    return notAllowed()
  }

  await db
    .update(documents)
    .set({ title: untitledRow(title), updatedAt: new Date() })
    .where(eq(documents.id, rowId))

  await indexDocument(rowId)
  revalidatePath(`/doc/${row.parentId}`)
  revalidatePath(`/doc/${rowId}`)

  return { ok: true }
}

export async function deleteDatabaseRow(
  rowId: string,
): Promise<DatabaseActionResult> {
  const row = await db.query.documents.findFirst({
    where: and(eq(documents.id, rowId), eq(documents.kind, 'row')),
  })

  if (!row || !row.parentId || !(await canEditDatabase(row.parentId))) {
    return notAllowed()
  }

  const descendants = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.parentId, rowId))

  const ids = [rowId, ...descendants.map((item) => item.id)]

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(inArray(documents.id, ids), isNull(documents.deletedAt)))

  for (const id of ids) {
    await removeDocumentFromIndex(id)
  }

  revalidatePath(`/doc/${row.parentId}`)
  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function createDatabaseView(
  databaseId: string,
  type: DatabaseViewType,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await canEditDatabase(databaseId))) {
    return notAllowed()
  }

  if (!viewTypes.includes(type)) {
    return notAllowed()
  }

  const existing = await db
    .select({ id: databaseViews.id })
    .from(databaseViews)
    .where(eq(databaseViews.databaseId, databaseId))
    .orderBy(asc(databaseViews.position))

  if (existing.length >= MAX_VIEWS) {
    return notAllowed()
  }

  const t = await getTranslations('database')
  const id = nanoid(12)
  const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)

  await db.insert(databaseViews).values({
    id,
    databaseId,
    name: trimmed.length > 0 ? trimmed : t(`view_${type}`),
    type,
    config: serializeViewConfig({
      groupByPropertyId: null,
      filters: [],
      sorts: [],
      hiddenPropertyIds: [],
    }),
    position: existing.length,
    createdAt: new Date(),
  })

  revalidatePath(`/doc/${databaseId}`)

  return { ok: true, id }
}

export async function updateDatabaseView(
  viewId: string,
  changes: Readonly<{
    name?: string
    type?: DatabaseViewType
    config?: ViewConfig
  }>,
): Promise<DatabaseActionResult> {
  const view = await databaseIdOfView(viewId)

  if (!view || !(await canEditDatabase(view.databaseId))) {
    return notAllowed()
  }

  const next: { name?: string; type?: DatabaseViewType; config?: string } = {}

  if (changes.type !== undefined) {
    if (!viewTypes.includes(changes.type)) {
      return notAllowed()
    }

    next.type = changes.type
  }

  if (changes.name !== undefined) {
    const trimmed = changes.name.trim().slice(0, MAX_PROPERTY_NAME)

    if (trimmed.length === 0) {
      return notAllowed()
    }

    next.name = trimmed
  }

  if (changes.config !== undefined) {
    next.config = serializeViewConfig(
      parseViewConfig(serializeViewConfig(changes.config)),
    )
  }

  if (Object.keys(next).length === 0) {
    return { ok: true }
  }

  await db
    .update(databaseViews)
    .set(next)
    .where(eq(databaseViews.id, viewId))

  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function saveDatabaseViewDraft(
  viewId: string,
  config: ViewConfig,
): Promise<DatabaseActionResult> {
  const view = await databaseIdOfView(viewId)

  if (!view) {
    return notAllowed()
  }

  const session = await requireSession()
  const access = await getDocumentAccess(view.databaseId, session)

  if (!access) {
    return notAllowed()
  }

  const serialized = serializeViewConfig(
    parseViewConfig(serializeViewConfig(config)),
  )

  const existing = await db.query.databaseViewDrafts.findFirst({
    where: and(
      eq(databaseViewDrafts.viewId, viewId),
      eq(databaseViewDrafts.userId, session.user.id),
    ),
  })

  if (existing) {
    await db
      .update(databaseViewDrafts)
      .set({ config: serialized, updatedAt: new Date() })
      .where(eq(databaseViewDrafts.id, existing.id))

    return { ok: true }
  }

  await db.insert(databaseViewDrafts).values({
    id: nanoid(12),
    viewId,
    userId: session.user.id,
    config: serialized,
    updatedAt: new Date(),
  })

  return { ok: true }
}

export async function clearDatabaseViewDraft(
  viewId: string,
): Promise<DatabaseActionResult> {
  const view = await databaseIdOfView(viewId)

  if (!view) {
    return notAllowed()
  }

  const session = await requireSession()
  const access = await getDocumentAccess(view.databaseId, session)

  if (!access) {
    return notAllowed()
  }

  await db
    .delete(databaseViewDrafts)
    .where(
      and(
        eq(databaseViewDrafts.viewId, viewId),
        eq(databaseViewDrafts.userId, session.user.id),
      ),
    )

  return { ok: true }
}

export async function publishDatabaseViewDraft(
  viewId: string,
  config: ViewConfig,
): Promise<DatabaseActionResult> {
  const view = await databaseIdOfView(viewId)

  if (!view || !(await canEditDatabase(view.databaseId))) {
    return notAllowed()
  }

  const session = await requireSession()

  await db
    .update(databaseViews)
    .set({
      config: serializeViewConfig(
        parseViewConfig(serializeViewConfig(config)),
      ),
    })
    .where(eq(databaseViews.id, viewId))

  await db
    .delete(databaseViewDrafts)
    .where(
      and(
        eq(databaseViewDrafts.viewId, viewId),
        eq(databaseViewDrafts.userId, session.user.id),
      ),
    )

  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function deleteDatabaseView(
  viewId: string,
): Promise<DatabaseActionResult> {
  const view = await databaseIdOfView(viewId)

  if (!view || !(await canEditDatabase(view.databaseId))) {
    return notAllowed()
  }

  const [count] = await db
    .select({ total: sql<number>`count(*)` })
    .from(databaseViews)
    .where(eq(databaseViews.databaseId, view.databaseId))

  if (Number(count?.total ?? 0) <= 1) {
    return {
      ok: false,
      error: (await getTranslations('database'))('lastViewKept'),
    }
  }

  await db.delete(databaseViews).where(eq(databaseViews.id, viewId))

  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViewDrafts,
  databaseViews,
  documents,
} from '@/db/schema'
import type { DatabaseProperty, DatabaseView, Document } from '@/db/schema'
import type { Person } from '@/lib/database/people'
import type { DatabaseRow } from '@/lib/database/views'
import {
  TITLE_PROPERTY_ID,
  parseViewConfig,
  serializeViewConfig,
} from '@/lib/database/views'
import { parseValues, serializeValues } from '@/lib/database/values'
import { type FormSlackLink, listFormSlackLinks } from '@/lib/form-webhooks'
import { listOrganizationPeople } from '@/lib/organizations'
import { isSlackBotConfigured } from '@/lib/slack/config'

export const MAX_DATABASE_ROWS = 5_000

export type DatabaseSnapshot = Readonly<{
  id: string
  title: string
  properties: Array<DatabaseProperty>
  views: Array<DatabaseView>
  drafts: Record<string, string | null>
  rows: Array<DatabaseRow>
  templates: Array<DatabaseRow>
  defaultTemplateId: string | null
  people: Array<Person>
  viewerId: string | null
  notifyingViewIds: Array<string>
  slackLinks: Array<FormSlackLink>
  slackBotReady: boolean
}>

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function toDatabaseRow(
  document: Pick<
    Document,
    | 'id'
    | 'title'
    | 'icon'
    | 'cover'
    | 'properties'
    | 'createdAt'
    | 'updatedAt'
  >,
): DatabaseRow {
  return {
    id: document.id,
    title: document.title,
    icon: document.icon,
    cover: document.cover,
    values: parseValues(document.properties),
    createdAt: toIso(document.createdAt),
    updatedAt: toIso(document.updatedAt),
  }
}

export async function getDatabaseDocument(databaseId: string) {
  const document = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, databaseId),
      eq(documents.kind, 'database'),
      isNull(documents.deletedAt),
    ),
  })

  return document ?? null
}

export async function listDatabaseProperties(
  databaseId: string,
): Promise<Array<DatabaseProperty>> {
  return db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, databaseId))
    .orderBy(asc(databaseProperties.position), asc(databaseProperties.id))
}

export async function listDatabaseViews(
  databaseId: string,
): Promise<Array<DatabaseView>> {
  return db
    .select()
    .from(databaseViews)
    .where(eq(databaseViews.databaseId, databaseId))
    .orderBy(asc(databaseViews.position), asc(databaseViews.id))
}

export async function listDatabaseRows(
  databaseId: string,
): Promise<Array<DatabaseRow>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      icon: documents.icon,
      cover: documents.cover,
      properties: documents.properties,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.parentId, databaseId),
        eq(documents.kind, 'row'),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(asc(documents.createdAt), asc(documents.id))
    .limit(MAX_DATABASE_ROWS)

  return rows.map(toDatabaseRow)
}

export async function listDatabaseTemplates(
  databaseId: string,
): Promise<Array<DatabaseRow>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      icon: documents.icon,
      cover: documents.cover,
      properties: documents.properties,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.parentId, databaseId),
        eq(documents.kind, 'template'),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(asc(documents.createdAt), asc(documents.id))

  return rows.map(toDatabaseRow)
}

export async function listDatabasePeople(
  orgId: string | null,
  viewerId: string | null = null,
): Promise<Array<Person>> {
  if (!orgId) {
    return []
  }

  const members = await listOrganizationPeople(orgId)
  const insider =
    viewerId !== null && members.some((member) => member.userId === viewerId)

  return members.map((member) => ({
    id: member.userId,
    name: member.name,
    email: insider ? member.email : '',
    image: member.image,
  }))
}

export async function loadDatabase(
  databaseId: string,
  viewerId: string | null = null,
): Promise<DatabaseSnapshot | null> {
  const document = await getDatabaseDocument(databaseId)

  if (!document) {
    return null
  }

  const [properties, views, rows, templates, people, slackLinks] =
    await Promise.all([
      listDatabaseProperties(databaseId),
      listDatabaseViews(databaseId),
      listDatabaseRows(databaseId),
      listDatabaseTemplates(databaseId),
      listDatabasePeople(document.orgId, viewerId),
      listFormSlackLinks(databaseId),
    ])

  return {
    id: document.id,
    title: document.title,
    properties,
    views,
    drafts: await listViewDrafts(
      views.map((view) => view.id),
      viewerId,
    ),
    rows,
    templates,
    defaultTemplateId: document.defaultTemplateId,
    people,
    viewerId,
    notifyingViewIds: slackLinks.map((link) => link.viewId),
    slackLinks,
    slackBotReady: isSlackBotConfigured(),
  }
}

export async function listViewDrafts(
  viewIds: ReadonlyArray<string>,
  viewerId: string | null,
): Promise<Record<string, string | null>> {
  if (!viewerId || viewIds.length === 0) {
    return {}
  }

  const drafts = await db
    .select({
      viewId: databaseViewDrafts.viewId,
      config: databaseViewDrafts.config,
    })
    .from(databaseViewDrafts)
    .where(
      and(
        eq(databaseViewDrafts.userId, viewerId),
        inArray(databaseViewDrafts.viewId, [...viewIds]),
      ),
    )

  return Object.fromEntries(
    drafts.map((draft) => [draft.viewId, draft.config]),
  )
}

export async function getRowDocument(rowId: string) {
  const document = await db.query.documents.findFirst({
    where: and(eq(documents.id, rowId), eq(documents.kind, 'row')),
  })

  return document ?? null
}

export async function getRowOrTemplateDocument(rowId: string) {
  const document = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, rowId),
      inArray(documents.kind, ['row', 'template']),
    ),
  })

  return document ?? null
}

export type RowContext = Readonly<{
  databaseId: string
  databaseTitle: string
  databaseIcon: string | null
  properties: Array<DatabaseProperty>
  row: DatabaseRow
  people: Array<Person>
  isTemplate: boolean
  isDefaultTemplate: boolean
}>

export async function loadRowContext(
  rowId: string,
  viewerId: string | null = null,
): Promise<RowContext | null> {
  const row = await getRowOrTemplateDocument(rowId)

  if (!row || !row.parentId) {
    return null
  }

  const database = await getDatabaseDocument(row.parentId)

  if (!database) {
    return null
  }

  const [properties, people] = await Promise.all([
    listDatabaseProperties(database.id),
    listDatabasePeople(database.orgId, viewerId),
  ])

  return {
    databaseId: database.id,
    databaseTitle: database.title,
    databaseIcon: database.icon,
    properties,
    row: toDatabaseRow(row),
    people,
    isTemplate: row.kind === 'template',
    isDefaultTemplate: database.defaultTemplateId === row.id,
  }
}

function remapConfig(
  raw: string | null,
  idByOldId: ReadonlyMap<string, string>,
): string {
  const config = parseViewConfig(raw)

  function remap(propertyId: string): string {
    if (propertyId === TITLE_PROPERTY_ID) {
      return propertyId
    }

    return idByOldId.get(propertyId) ?? propertyId
  }

  return serializeViewConfig({
    ...config,
    groupByPropertyId: config.groupByPropertyId
      ? remap(config.groupByPropertyId)
      : null,
    datePropertyId: config.datePropertyId
      ? remap(config.datePropertyId)
      : null,
    endDatePropertyId: config.endDatePropertyId
      ? remap(config.endDatePropertyId)
      : null,
    filters: config.filters.map((filter) => ({
      ...filter,
      propertyId: remap(filter.propertyId),
    })),
    sorts: config.sorts.map((sort) => ({
      ...sort,
      propertyId: remap(sort.propertyId),
    })),
    hiddenPropertyIds: config.hiddenPropertyIds.map(remap),
    form: config.form
      ? {
          ...config.form,
          questions: config.form.questions.map((question) => ({
            ...question,
            propertyId: remap(question.propertyId),
          })),
          automations: config.form.automations.map((automation) => ({
            ...automation,
            propertyId: remap(automation.propertyId),
          })),
        }
      : null,
  })
}

export async function copyDatabaseInto(
  sourceId: string,
  targetId: string,
  ownerId: string,
  now: Date,
): Promise<Array<string>> {
  const [properties, views, target] = await Promise.all([
    listDatabaseProperties(sourceId),
    listDatabaseViews(sourceId),
    db.query.documents.findFirst({ where: eq(documents.id, targetId) }),
  ])

  if (!target) {
    return []
  }

  const idByOldId = new Map<string, string>()

  for (const property of properties) {
    idByOldId.set(property.id, nanoid(12))
  }

  if (properties.length > 0) {
    await db.insert(databaseProperties).values(
      properties.map((property) => ({
        id: idByOldId.get(property.id) as string,
        databaseId: targetId,
        name: property.name,
        type: property.type,
        options: property.options,
        position: property.position,
        createdAt: now,
      })),
    )
  }

  if (views.length > 0) {
    await db.insert(databaseViews).values(
      views.map((view) => ({
        id: nanoid(12),
        databaseId: targetId,
        name: view.name,
        type: view.type,
        config: remapConfig(view.config, idByOldId),
        position: view.position,
        createdAt: now,
      })),
    )
  }

  const rows = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      title: documents.title,
      icon: documents.icon,
      cover: documents.cover,
      content: documents.content,
      properties: documents.properties,
    })
    .from(documents)
    .where(
      and(
        eq(documents.parentId, sourceId),
        inArray(documents.kind, ['row', 'template']),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(asc(documents.createdAt), asc(documents.id))
    .limit(MAX_DATABASE_ROWS)

  const created: Array<string> = []
  const templateIdByOldId = new Map<string, string>()

  for (const [index, row] of rows.entries()) {
    const values = parseValues(row.properties)
    const remapped: Record<string, unknown> = {}

    for (const [propertyId, value] of Object.entries(values)) {
      const nextId = idByOldId.get(propertyId)

      if (nextId) {
        remapped[nextId] = value
      }
    }

    const id = nanoid(12)
    const stamp = new Date(now.getTime() + index)

    if (row.kind === 'template') {
      templateIdByOldId.set(row.id, id)
    } else {
      created.push(id)
    }

    await db.insert(documents).values({
      id,
      ownerId,
      parentId: targetId,
      orgId: target.orgId,
      teamspaceId: target.teamspaceId,
      orgAccess: target.orgAccess,
      kind: row.kind,
      title: row.title,
      icon: row.icon,
      cover: row.cover,
      content: row.content,
      properties: serializeValues(
        remapped as Parameters<typeof serializeValues>[0],
      ),
      createdAt: stamp,
      updatedAt: stamp,
    })
  }

  const source = await getDatabaseDocument(sourceId)
  const copiedDefault = source?.defaultTemplateId
    ? templateIdByOldId.get(source.defaultTemplateId)
    : undefined

  if (copiedDefault) {
    await db
      .update(documents)
      .set({ defaultTemplateId: copiedDefault })
      .where(eq(documents.id, targetId))
  }

  return created
}

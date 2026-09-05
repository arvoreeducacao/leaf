import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import { databaseViews, documents } from '@/db/schema'
import type { DatabaseProperty, DatabaseView, Document } from '@/db/schema'
import { isPublicTokenShaped, registerPublicLookupAttempt } from '@/lib/authz'
import {
  type FormConfig,
  type ResolvedQuestion,
  resolveQuestions,
} from '@/lib/database/forms'
import { parseViewConfig } from '@/lib/database/views'
import { listDatabaseProperties } from '@/lib/databases'

export type PublicForm = Readonly<{
  token: string
  viewId: string
  databaseId: string
  databaseTitle: string
  databaseIcon: string | null
  config: FormConfig
  questions: Array<ResolvedQuestion>
}>

export type FormLookupResult =
  | { status: 'ok'; form: PublicForm }
  | { status: 'not-found' }
  | { status: 'rate-limited'; retryAfterSeconds: number }

export type FormRecord = Readonly<{
  view: DatabaseView
  database: Document
  properties: Array<DatabaseProperty>
  config: FormConfig
}>

export async function getFormByToken(
  token: string,
): Promise<FormRecord | null> {
  if (!isPublicTokenShaped(token)) {
    return null
  }

  const view = await db.query.databaseViews.findFirst({
    where: and(
      eq(databaseViews.publicToken, token),
      eq(databaseViews.type, 'form'),
    ),
  })

  if (!view) {
    return null
  }

  const config = parseViewConfig(view.config).form

  if (!config) {
    return null
  }

  const database = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, view.databaseId),
      eq(documents.kind, 'database'),
      isNull(documents.deletedAt),
    ),
  })

  if (!database) {
    return null
  }

  return {
    view,
    database,
    config,
    properties: await listDatabaseProperties(database.id),
  }
}

export function toPublicForm(
  record: FormRecord,
  titleName: string,
): PublicForm {
  return {
    token: record.view.publicToken ?? '',
    viewId: record.view.id,
    databaseId: record.database.id,
    databaseTitle: record.database.title,
    databaseIcon: record.database.icon,
    config: record.config,
    questions: resolveQuestions(record.config, record.properties, titleName),
  }
}

export async function lookupPublicForm(
  token: string,
  requesterKey: string,
  titleName: string,
): Promise<FormLookupResult> {
  const decision = registerPublicLookupAttempt(requesterKey)

  if (!decision.allowed) {
    return {
      status: 'rate-limited',
      retryAfterSeconds: decision.retryAfterSeconds,
    }
  }

  const record = await getFormByToken(token)

  if (!record) {
    return { status: 'not-found' }
  }

  return { status: 'ok', form: toPublicForm(record, titleName) }
}

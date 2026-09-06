'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { db } from '@/db'
import { databaseViews, documents } from '@/db/schema'
import { getSession } from '@/lib/auth'
import {
  canEdit,
  getDocumentAccess,
  registerFormSubmissionAttempt,
} from '@/lib/authz'
import { isSlackWebhook, slackPayloadFor } from '@/lib/database/form-message'
import { buildSubmission } from '@/lib/database/forms'
import { serializeValues } from '@/lib/database/values'
import { MAX_DATABASE_ROWS } from '@/lib/databases'
import {
  removeFormWebhook,
  saveFormChannel,
  saveFormWebhookUrl,
  setFormThreadSync,
} from '@/lib/form-webhooks'
import { getFormByToken } from '@/lib/forms'
import { authIssuer as appBaseUrl } from '@/lib/mcp-config'
import { indexDocument } from '@/lib/search-index'
import { parseChannelRef, slackBotToken } from '@/lib/slack/config'
import { announceSubmission, botClient } from '@/lib/slack/sync'

const FORM_TOKEN_LENGTH = 24

export type FormActionResult = { ok: true } | { ok: false; error: string }

export type FormLinkResult =
  | { ok: true; token: string | null }
  | { ok: false; error: string }

export type FormSubmitResult =
  | { ok: true }
  | { ok: false; error: string; missing?: Array<string> }

async function notAllowed(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: (await getTranslations('errors'))('notAllowed') }
}

async function requesterKey() {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()

  return forwarded || headerList.get('x-real-ip') || 'unknown'
}

async function editableFormView(viewId: string) {
  const session = await getSession()

  if (!session) {
    return null
  }

  const view = await db.query.databaseViews.findFirst({
    where: eq(databaseViews.id, viewId),
  })

  if (!view || view.type !== 'form') {
    return null
  }

  const access = await getDocumentAccess(view.databaseId, session)

  return canEdit(access) ? view : null
}

export async function enableFormLink(viewId: string): Promise<FormLinkResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  const token = view.publicToken ?? nanoid(FORM_TOKEN_LENGTH)

  await db
    .update(databaseViews)
    .set({ publicToken: token })
    .where(eq(databaseViews.id, viewId))

  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true, token }
}

export async function disableFormLink(viewId: string): Promise<FormLinkResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  await db
    .update(databaseViews)
    .set({ publicToken: null })
    .where(eq(databaseViews.id, viewId))

  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true, token: null }
}

export async function setFormWebhook(
  viewId: string,
  url: string,
): Promise<FormActionResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  const trimmed = url.trim()

  if (!isSlackWebhook(trimmed)) {
    return {
      ok: false,
      error: (await getTranslations('form'))('webhookInvalid'),
    }
  }

  await saveFormWebhookUrl(viewId, trimmed)
  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function setFormChannel(
  viewId: string,
  reference: string,
): Promise<FormActionResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  const t = await getTranslations('form')
  const channelId = parseChannelRef(reference)

  if (!channelId || slackBotToken() === null) {
    return { ok: false, error: t('channelInvalid') }
  }

  const client = botClient()
  const channel = client ? await client.channelInfo(channelId) : null

  if (!channel) {
    return { ok: false, error: t('channelUnreachable') }
  }

  await saveFormChannel(viewId, channel.id, channel.name)
  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function setFormThreadOptions(
  viewId: string,
  pullThread: boolean,
  pushComments: boolean,
): Promise<FormActionResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  await setFormThreadSync(viewId, pullThread, pushComments)
  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function clearFormWebhook(
  viewId: string,
): Promise<FormActionResult> {
  const view = await editableFormView(viewId)

  if (!view) {
    return notAllowed()
  }

  await removeFormWebhook(viewId)
  revalidatePath(`/doc/${view.databaseId}`)

  return { ok: true }
}

export async function submitForm(
  token: string,
  answers: Readonly<Record<string, unknown>>,
): Promise<FormSubmitResult> {
  const t = await getTranslations('form')

  if (!registerFormSubmissionAttempt(await requesterKey()).allowed) {
    return { ok: false, error: t('tooManySubmissions') }
  }

  const record = await getFormByToken(token)

  if (!record) {
    return { ok: false, error: t('notFound') }
  }

  if (!record.config.accepting) {
    return { ok: false, error: t('closed') }
  }

  const [count] = await db
    .select({ total: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.parentId, record.database.id),
        eq(documents.kind, 'row'),
        isNull(documents.deletedAt),
      ),
    )

  if (Number(count?.total ?? 0) >= MAX_DATABASE_ROWS) {
    return { ok: false, error: t('closed') }
  }

  const session = await getSession()
  const now = new Date()

  const built = buildSubmission(
    record.config,
    record.properties,
    answers,
    (await getTranslations('database'))('titleColumn'),
    {
      submittedOn: now.toISOString().slice(0, 10),
      submitterId: session?.user.id ?? null,
    },
  )

  if (!built.ok) {
    return { ok: false, error: t('missingAnswers'), missing: built.missing }
  }

  const id = nanoid(12)

  await db.insert(documents).values({
    id,
    ownerId: record.database.ownerId,
    parentId: record.database.id,
    orgId: record.database.orgId,
    teamspaceId: record.database.teamspaceId,
    orgAccess: record.database.orgAccess,
    kind: 'row',
    title: built.submission.title,
    properties: serializeValues(built.submission.values),
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(documents)
    .set({ updatedAt: now })
    .where(eq(documents.id, record.database.id))

  await indexDocument(id)

  if (record.config.notify) {
    await announceSubmission({
      documentId: id,
      payload: slackPayloadFor(
        record.config,
        record.properties,
        built.submission.title,
        built.submission.values,
        (await getTranslations('database'))('titleColumn'),
        `${appBaseUrl()}/doc/${id}`,
        t('openInLeaf'),
        appBaseUrl(),
      ),
      replyHint: t('slackReplyHint'),
      viewId: record.view.id,
    })
  }

  revalidatePath(`/doc/${record.database.id}`)

  return { ok: true }
}

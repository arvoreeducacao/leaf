import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { notionConnections } from '@/db/schema'
import type { NotionConnection } from '@/db/schema'
import { NOTION_API_BASE } from '@/lib/notion/api'

export const notionStateCookie = 'leaf-notion-state'

export type NotionOAuthConfig = Readonly<{
  clientId: string
  clientSecret: string
  redirectUri: string
}>

export type NotionTokenResponse = Readonly<{
  access_token?: string
  bot_id?: string
  workspace_id?: string
  workspace_name?: string
}>

export function notionOAuthConfig(): NotionOAuthConfig | null {
  const clientId = process.env.NOTION_CLIENT_ID?.trim()
  const clientSecret = process.env.NOTION_CLIENT_SECRET?.trim()
  const appUrl = process.env.NOTION_REDIRECT_URI?.trim()

  if (!clientId || !clientSecret || !appUrl) {
    return null
  }

  return { clientId, clientSecret, redirectUri: appUrl }
}

export function notionAuthorizeUrl(
  config: NotionOAuthConfig,
  state: string,
): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    owner: 'user',
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  })

  return `${NOTION_API_BASE}/oauth/authorize?${query.toString()}`
}

export async function exchangeNotionCode(
  config: NotionOAuthConfig,
  code: string,
): Promise<NotionTokenResponse | null> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString('base64')

  const response = await fetch(`${NOTION_API_BASE}/oauth/token`, {
    body: JSON.stringify({
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as NotionTokenResponse
}

export async function saveNotionConnection(
  userId: string,
  token: NotionTokenResponse,
): Promise<boolean> {
  if (!token.access_token) {
    return false
  }

  const now = new Date()
  const values = {
    accessToken: token.access_token,
    botId: token.bot_id ?? null,
    createdAt: now,
    updatedAt: now,
    userId,
    workspaceId: token.workspace_id ?? null,
    workspaceName: token.workspace_name ?? null,
  }

  await db
    .insert(notionConnections)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        accessToken: values.accessToken,
        botId: values.botId,
        updatedAt: now,
        workspaceId: values.workspaceId,
        workspaceName: values.workspaceName,
      },
    })

  return true
}

export async function getNotionConnection(
  userId: string,
): Promise<NotionConnection | null> {
  const row = await db.query.notionConnections.findFirst({
    where: eq(notionConnections.userId, userId),
  })

  return row ?? null
}

export async function removeNotionConnection(userId: string) {
  await db
    .delete(notionConnections)
    .where(eq(notionConnections.userId, userId))
}

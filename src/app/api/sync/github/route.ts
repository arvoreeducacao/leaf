import { timingSafeEqual } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { db } from '@/db'
import { user } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { createGithubClient } from '@/lib/github/api'
import {
  githubConfig,
  githubSyncOwnerEmail,
  githubSyncSecret,
} from '@/lib/github/config'
import { buildGithubSyncMessages } from '@/lib/github/messages'
import { syncGithub } from '@/lib/github/sync'
import type { GithubSyncSummary } from '@/lib/github/sync'
import {
  destinationOfParent,
  parseImportDestination,
  resolveImportPlacement,
} from '@/lib/import-destination'

export const runtime = 'nodejs'

export const maxDuration = 900

function secretMatches(expected: string, presented: string): boolean {
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(presented, 'utf8')

  return left.length === right.length && timingSafeEqual(left, right)
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())

  return match ? match[1].trim() : null
}

async function serviceUserId(request: Request): Promise<string | null> {
  const secret = githubSyncSecret()
  const presented = bearerToken(request)

  if (!secret || !presented || !secretMatches(secret, presented)) {
    return null
  }

  const email = githubSyncOwnerEmail()

  if (!email) {
    return null
  }

  const owner = await db.query.user.findFirst({
    columns: { id: true },
    where: eq(user.email, email),
  })

  return owner?.id ?? null
}

export async function POST(request: Request) {
  const t = await getTranslations('githubSync')
  const config = githubConfig()

  if (!config) {
    return NextResponse.json({ error: t('notConfigured') }, { status: 412 })
  }

  const payload: unknown = await request.json().catch(() => null)
  const body = (payload ?? {}) as Record<string, unknown>

  let userId = await serviceUserId(request)

  if (!userId) {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: t('notAuthenticated') },
        { status: 401 },
      )
    }

    userId = session.user.id
  }

  const destination =
    parseImportDestination(body.destination) ?? destinationOfParent(null)
  const placement = await resolveImportPlacement(destination, userId)

  if (!placement) {
    return NextResponse.json(
      { error: (await getTranslations('errors'))('notAllowed') },
      { status: 403 },
    )
  }

  const messages = buildGithubSyncMessages(
    t,
    (await getTranslations('document'))('untitled'),
  )
  const client = createGithubClient(config.token, { signal: request.signal })
  const owner = {
    id: userId,
    orgAccess: placement.orgAccess,
    orgId: placement.orgId,
    parentId: null,
    teamspaceId: placement.teamspaceId,
  }

  let summary: GithubSyncSummary | null = null

  try {
    for await (const event of syncGithub(
      client,
      config.repos,
      owner,
      messages,
      request.signal,
      { force: body.force === true },
    )) {
      if (event.type === 'done') {
        summary = event.summary
      }
    }
  } catch {
    return NextResponse.json({ error: t('unfinished') }, { status: 502 })
  }

  if (!summary) {
    return NextResponse.json({ error: t('unfinished') }, { status: 502 })
  }

  revalidatePath('/', 'layout')

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

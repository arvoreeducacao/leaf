import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import type { NotionOAuthConfig } from '@/lib/notion/connection'
import {
  exchangeNotionCode,
  notionAppOrigin,
  notionOAuthConfig,
  notionReturnCookie,
  notionReturnUrl,
  notionStateCookie,
  safeReturnPath,
  saveNotionConnection,
} from '@/lib/notion/connection'

export const runtime = 'nodejs'

function back(
  config: NotionOAuthConfig,
  returnPath: string | null,
  status: 'connected' | 'failed',
) {
  return NextResponse.redirect(
    notionReturnUrl(notionAppOrigin(config), returnPath, status),
  )
}

export async function GET(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const config = notionOAuthConfig()

  if (!config) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const store = await cookies()
  const expected = store.get(notionStateCookie)?.value
  const returnPath = safeReturnPath(store.get(notionReturnCookie)?.value)

  store.delete(notionStateCookie)
  store.delete(notionReturnCookie)

  if (!code || !state || !expected || state !== expected) {
    return back(config, returnPath, 'failed')
  }

  const token = await exchangeNotionCode(config, code)

  if (!token || !(await saveNotionConnection(session.user.id, token))) {
    return back(config, returnPath, 'failed')
  }

  return back(config, returnPath, 'connected')
}

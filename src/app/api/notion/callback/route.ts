import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import {
  exchangeNotionCode,
  notionOAuthConfig,
  notionReturnCookie,
  notionStateCookie,
  safeReturnPath,
  saveNotionConnection,
} from '@/lib/notion/connection'

export const runtime = 'nodejs'

function back(
  request: Request,
  returnPath: string | null,
  status: 'connected' | 'failed',
) {
  const url = new URL(returnPath ?? '/', request.url)
  url.searchParams.set('notion', status)

  return NextResponse.redirect(url)
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
    return back(request, returnPath, 'failed')
  }

  const token = await exchangeNotionCode(config, code)

  if (!token || !(await saveNotionConnection(session.user.id, token))) {
    return back(request, returnPath, 'failed')
  }

  return back(request, returnPath, 'connected')
}

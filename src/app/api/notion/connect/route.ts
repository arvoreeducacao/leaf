import { randomBytes } from 'node:crypto'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import {
  notionAuthorizeUrl,
  notionOAuthConfig,
  notionReturnCookie,
  notionStateCookie,
  safeReturnPath,
} from '@/lib/notion/connection'

export const runtime = 'nodejs'

const cookieLifetimeSeconds = 600

export async function GET(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const config = notionOAuthConfig()

  if (!config) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  const state = randomBytes(24).toString('base64url')
  const store = await cookies()
  const cookieOptions = {
    httpOnly: true,
    maxAge: cookieLifetimeSeconds,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }

  store.set(notionStateCookie, state, cookieOptions)

  const returnPath = safeReturnPath(
    new URL(request.url).searchParams.get('return'),
  )

  if (returnPath) {
    store.set(notionReturnCookie, returnPath, cookieOptions)
  } else {
    store.delete(notionReturnCookie)
  }

  return NextResponse.redirect(notionAuthorizeUrl(config, state))
}

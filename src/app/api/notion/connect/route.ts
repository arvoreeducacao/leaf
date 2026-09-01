import { randomBytes } from 'node:crypto'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import {
  notionAuthorizeUrl,
  notionOAuthConfig,
  notionStateCookie,
} from '@/lib/notion/connection'

export const runtime = 'nodejs'

export async function GET() {
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

  store.set(notionStateCookie, state, {
    httpOnly: true,
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.redirect(notionAuthorizeUrl(config, state))
}

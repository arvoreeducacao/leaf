import { getTranslations } from 'next-intl/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { registerUnsplashAttempt } from '@/lib/authz'
import {
  searchUnsplashPhotos,
  unsplashAccessKey,
  unsplashMaxQueryLength,
} from '@/lib/unsplash'

function pageOf(value: string | null) {
  const page = Number.parseInt(value ?? '1', 10)

  return Number.isFinite(page) && page >= 1 ? Math.min(page, 50) : 1
}

export async function GET(request: Request) {
  const t = await getTranslations('cover')
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: t('notAuthenticated') }, { status: 401 })
  }

  const key = unsplashAccessKey()

  if (!key) {
    return NextResponse.json(
      { error: t('unsplashNotConfigured') },
      { status: 503 },
    )
  }

  const decision = registerUnsplashAttempt(session.user.id)

  if (!decision.allowed) {
    return NextResponse.json(
      { error: t('unsplashTooFast') },
      {
        status: 429,
        headers: { 'Retry-After': String(decision.retryAfterSeconds) },
      },
    )
  }

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('query') ?? '').slice(
    0,
    unsplashMaxQueryLength,
  )

  try {
    const result = await searchUnsplashPhotos(
      query,
      pageOf(searchParams.get('page')),
      key,
    )

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch {
    return NextResponse.json({ error: t('unsplashFailed') }, { status: 502 })
  }
}

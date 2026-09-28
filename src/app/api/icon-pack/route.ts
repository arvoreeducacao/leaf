import { getTranslations } from 'next-intl/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { loadIconPack } from '@/lib/icon-pack-source'

export async function GET() {
  const session = await getSession()

  if (!session) {
    const t = await getTranslations('uploads')

    return NextResponse.json({ error: t('notAuthenticated') }, { status: 401 })
  }

  const pack = await loadIconPack()

  return NextResponse.json(
    { pack },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}

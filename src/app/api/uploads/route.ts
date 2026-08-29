import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { storage } from '@/lib/storage'

const MAX_BYTES = 5 * 1024 * 1024

const extensionByType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

export async function POST(request: Request) {
  const t = await getTranslations('uploads')
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: t('notAuthenticated') }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: t('missingFile') },
      { status: 400 },
    )
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: t('imagesOnly') },
      { status: 415 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: t('tooLarge', { limit: '5 MB' }) },
      { status: 413 },
    )
  }

  const extension = extensionByType[file.type] ?? 'bin'
  const key = `u/${nanoid(16)}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await storage.put(key, buffer, file.type)
  } catch {
    return NextResponse.json(
      { error: t('saveFailed') },
      { status: 502 },
    )
  }

  return NextResponse.json({ url: `/api/uploads/${key}` }, { status: 201 })
}

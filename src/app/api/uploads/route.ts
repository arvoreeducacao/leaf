import { getTranslations } from 'next-intl/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { MAX_UPLOAD_BYTES, storeUpload } from '@/lib/uploads'

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

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: t('tooLarge', { limit: '5 MB' }) },
      { status: 413 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let stored: { url: string }

  try {
    stored = await storeUpload(buffer, file.type)
  } catch {
    return NextResponse.json(
      { error: t('saveFailed') },
      { status: 502 },
    )
  }

  return NextResponse.json({ url: stored.url }, { status: 201 })
}

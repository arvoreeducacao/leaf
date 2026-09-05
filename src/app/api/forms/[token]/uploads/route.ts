import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { registerFormUploadAttempt } from '@/lib/authz'
import { getFormByToken } from '@/lib/forms'
import { MAX_UPLOAD_BYTES, looksLikeType, storeUpload } from '@/lib/uploads'

const acceptedTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
])

type Params = Readonly<{ params: Promise<{ token: string }> }>

async function requesterKey() {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()

  return forwarded || headerList.get('x-real-ip') || 'unknown'
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  const t = await getTranslations('uploads')

  if (!registerFormUploadAttempt(await requesterKey()).allowed) {
    return NextResponse.json(
      { error: (await getTranslations('form'))('tooManySubmissions') },
      { status: 429 },
    )
  }

  const record = await getFormByToken(token)

  if (!record || !record.config.accepting) {
    return NextResponse.json({ error: t('notAuthenticated') }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: t('missingFile') }, { status: 400 })
  }

  if (!acceptedTypes.has(file.type)) {
    return NextResponse.json({ error: t('imagesOnly') }, { status: 415 })
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: t('tooLarge', { limit: '5 MB' }) },
      { status: 413 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (!looksLikeType(buffer, file.type)) {
    return NextResponse.json({ error: t('imagesOnly') }, { status: 415 })
  }

  let stored: { url: string }

  try {
    stored = await storeUpload(buffer, file.type)
  } catch {
    return NextResponse.json({ error: t('saveFailed') }, { status: 502 })
  }

  return NextResponse.json({ url: stored.url }, { status: 201 })
}

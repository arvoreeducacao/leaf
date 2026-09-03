import { getTranslations } from 'next-intl/server'
import { NextResponse } from 'next/server'

import { storage } from '@/lib/storage'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: Array<string> }> },
) {
  const t = await getTranslations('uploads')
  const { key } = await params
  const objectKey = key.join('/')

  if (objectKey.includes('..')) {
    return NextResponse.json({ error: t('invalidKey') }, { status: 400 })
  }

  const object = await storage.get(objectKey)

  if (!object) {
    return NextResponse.json({ error: t('imageNotFound') }, { status: 404 })
  }

  const body = Buffer.isBuffer(object.body)
    ? new Uint8Array(object.body)
    : object.body

  const isImage = object.contentType.startsWith('image/')
  const fileName = objectKey.split('/').pop() ?? 'file'

  return new NextResponse(body as BodyInit, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': isImage
        ? 'inline'
        : `attachment; filename="${fileName}"`,
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Content-Type': object.contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

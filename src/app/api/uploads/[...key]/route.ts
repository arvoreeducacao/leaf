import { NextResponse } from 'next/server'

import { storage } from '@/lib/storage'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: Array<string> }> },
) {
  const { key } = await params
  const objectKey = key.join('/')

  if (objectKey.includes('..')) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 400 })
  }

  const object = await storage.get(objectKey)

  if (!object) {
    return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 })
  }

  const body = Buffer.isBuffer(object.body)
    ? new Uint8Array(object.body)
    : object.body

  return new NextResponse(body as BodyInit, {
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

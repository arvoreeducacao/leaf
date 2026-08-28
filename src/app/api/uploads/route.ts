import { nanoid } from 'nanoid'
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
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Envie um arquivo no campo file' },
      { status: 400 },
    )
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Só é possível enviar imagens' },
      { status: 415 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'A imagem passa do limite de 5 MB' },
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
      { error: 'Não foi possível salvar a imagem' },
      { status: 502 },
    )
  }

  return NextResponse.json({ url: `/api/uploads/${key}` }, { status: 201 })
}

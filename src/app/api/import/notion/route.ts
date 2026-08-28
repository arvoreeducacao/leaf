import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { importNotionZip } from '@/lib/notion/import'
import type { ImportEvent } from '@/lib/notion/import'
import { MAX_ZIP_BYTES, MAX_ZIP_LABEL, ZIP_EXTENSIONS } from '@/lib/notion/limits'

export const runtime = 'nodejs'

export const maxDuration = 300

function tooLarge() {
  return NextResponse.json(
    { error: `O arquivo passa de ${MAX_ZIP_LABEL}` },
    { status: 413 },
  )
}

export async function POST(request: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')

  if (declaredLength > MAX_ZIP_BYTES * 1.1) {
    return tooLarge()
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Envie um arquivo no campo file' },
      { status: 400 },
    )
  }

  const name = file.name.toLowerCase()

  if (!ZIP_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return NextResponse.json(
      { error: 'Escolha um arquivo .zip exportado do Notion' },
      { status: 415 },
    )
  }

  if (file.size > MAX_ZIP_BYTES) {
    return tooLarge()
  }

  const data = new Uint8Array(await file.arrayBuffer())
  const owner = { id: session.user.id }
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: ImportEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        for await (const event of importNotionZip(data, owner, request.signal)) {
          send(event)

          if (event.type === 'done') {
            revalidatePath('/', 'layout')
          }
        }
      } catch {
        send({ type: 'error', error: 'Não foi possível concluir a importação' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  })
}

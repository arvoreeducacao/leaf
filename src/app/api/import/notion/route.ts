import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { importNotionZip } from '@/lib/notion/import'
import type { ImportEvent } from '@/lib/notion/import'
import { MAX_ZIP_BYTES, MAX_ZIP_LABEL, ZIP_EXTENSIONS } from '@/lib/notion/limits'
import { buildNotionImportMessages } from '@/lib/notion/messages'
import { getMembership } from '@/lib/organizations'

export const runtime = 'nodejs'

export const maxDuration = 300

export async function POST(request: Request) {
  const t = await getTranslations('archiveImport')
  const messages = buildNotionImportMessages(
    t,
    (await getTranslations('document'))('untitled'),
  )

  function tooLarge() {
    return NextResponse.json(
      { error: t('tooLargeZip', { limit: MAX_ZIP_LABEL }) },
      { status: 413 },
    )
  }

  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { error: t('notAuthenticated') },
      { status: 401 },
    )
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')

  if (declaredLength > MAX_ZIP_BYTES * 1.1) {
    return tooLarge()
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: t('missingFile') },
      { status: 400 },
    )
  }

  const name = file.name.toLowerCase()

  if (!ZIP_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return NextResponse.json(
      { error: t('wrongExtension') },
      { status: 415 },
    )
  }

  if (file.size > MAX_ZIP_BYTES) {
    return tooLarge()
  }

  const requestedParent = formData.get('parentId')
  const parentId =
    typeof requestedParent === 'string' && requestedParent.length > 0
      ? requestedParent
      : null

  if (
    parentId &&
    (await getDocumentAccess(parentId, session)) !== 'owner'
  ) {
    return NextResponse.json(
      { error: (await getTranslations('errors'))('notAllowed') },
      { status: 403 },
    )
  }

  const data = new Uint8Array(await file.arrayBuffer())
  const membership = await getMembership(session.user.id)
  const owner = {
    id: session.user.id,
    orgId: membership?.orgId ?? null,
    parentId,
  }
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: ImportEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        for await (const event of importNotionZip(
          data,
          owner,
          messages,
          request.signal,
        )) {
          send(event)

          if (event.type === 'done') {
            revalidatePath('/', 'layout')
          }
        }
      } catch {
        send({ type: 'error', error: t('unfinished') })
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

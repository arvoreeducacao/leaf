import { getDocument } from '@/lib/documents'
import { isDocumentIdShaped } from '@/lib/realtime'
import { hasValidRealtimeSecret, isRealtimeEnabled } from '@/lib/realtime-config'
import { seedUpdateFromContent } from '@/lib/realtime-document'

export async function POST(request: Request) {
  if (!isRealtimeEnabled() || !hasValidRealtimeSecret(request)) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as {
    documentId?: unknown
  } | null

  if (!body || !isDocumentIdShaped(body.documentId)) {
    return Response.json({ error: 'bad-request' }, { status: 400 })
  }

  const document = await getDocument(body.documentId)

  if (!document || document.deletedAt !== null) {
    return Response.json({ status: 'not-found' }, { status: 404 })
  }

  const seed = seedUpdateFromContent(document.content)

  if (seed.status === 'unreadable') {
    return Response.json({ status: 'unreadable' })
  }

  return Response.json({
    status: 'ok',
    update: Buffer.from(seed.update).toString('base64'),
  })
}

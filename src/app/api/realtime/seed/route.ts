import { getDocument } from '@/lib/documents'
import { isDocumentIdShaped } from '@/lib/realtime'
import { hasValidRealtimeSecret, isRealtimeEnabled } from '@/lib/realtime-config'
import { seedUpdateFromContent } from '@/lib/realtime-document'
import {
  isRealtimeStateStale,
  newRealtimeIdentity,
  readRealtimeState,
  writeRealtimeState,
} from '@/lib/realtime-state'

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

  const stored = await readRealtimeState(body.documentId)

  if (
    stored &&
    !isRealtimeStateStale(stored.updatedAt, new Date(document.updatedAt))
  ) {
    return Response.json({
      status: 'ok',
      identity: stored.identity,
      update: Buffer.from(stored.state).toString('base64'),
    })
  }

  const seed = seedUpdateFromContent(document.content)

  if (seed.status === 'unreadable') {
    return Response.json({ status: 'unreadable' })
  }

  const identity = newRealtimeIdentity()

  await writeRealtimeState(body.documentId, seed.update, identity)

  return Response.json({
    status: 'ok',
    identity,
    update: Buffer.from(seed.update).toString('base64'),
  })
}

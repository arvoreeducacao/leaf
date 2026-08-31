import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { isDocumentIdShaped } from '@/lib/realtime'
import { hasValidRealtimeSecret, isRealtimeEnabled } from '@/lib/realtime-config'

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

  const session = await getSession()

  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const level = await getDocumentAccess(body.documentId, session)

  if (!level) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  return Response.json({
    level,
    canWrite: canEdit(level),
    user: {
      id: session.user.id,
      name: session.user.name,
    },
  })
}

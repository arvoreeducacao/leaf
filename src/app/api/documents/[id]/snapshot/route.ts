import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import { isRealtimeEnabled } from '@/lib/realtime-config'
import { readRealtimeIdentity } from '@/lib/realtime-state'

type Params = Readonly<{ params: Promise<{ id: string }> }>

function alreadyHeld(value: string | null, updatedAt: number) {
  if (!value) {
    return false
  }

  const since = Number(value)

  return Number.isFinite(since) && since >= updatedAt
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  const access = await getDocumentAccess(id, session)

  if (!access) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const document = await getDocument(id)

  if (!document || document.deletedAt !== null) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const identity = isRealtimeEnabled()
    ? await readRealtimeIdentity(document.id)
    : null

  const updatedAt = new Date(document.updatedAt).getTime()
  const since = new URL(request.url).searchParams.get('since')

  return Response.json(
    {
      title: document.title,
      content: alreadyHeld(since, updatedAt) ? null : document.content,
      identity,
      canEdit: canEdit(access),
      updatedAt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

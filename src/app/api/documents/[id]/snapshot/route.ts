import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import { isRealtimeEnabled } from '@/lib/realtime-config'
import { readRealtimeIdentity } from '@/lib/realtime-state'

type Params = Readonly<{ params: Promise<{ id: string }> }>

export async function GET(_request: Request, { params }: Params) {
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

  return Response.json(
    {
      title: document.title,
      content: document.content,
      identity,
      canEdit: canEdit(access),
      updatedAt: new Date(document.updatedAt).getTime(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

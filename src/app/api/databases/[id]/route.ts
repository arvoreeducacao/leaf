import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { loadDatabase } from '@/lib/databases'
import { isDocumentIdShaped } from '@/lib/realtime'

type Params = Readonly<{ params: Promise<{ id: string }> }>

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  if (!isDocumentIdShaped(id)) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const session = await getSession()
  const access = session ? await getDocumentAccess(id, session) : null

  if (!access) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const snapshot = await loadDatabase(id, session?.user.id ?? null)

  if (!snapshot) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  return Response.json(
    { snapshot, canEdit: canEdit(access) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

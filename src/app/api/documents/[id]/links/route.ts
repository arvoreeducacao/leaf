import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { listDocumentLinks } from '@/lib/document-link-graph'

type Params = Readonly<{ params: Promise<{ id: string }> }>

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  const access = await getDocumentAccess(id, session)

  if (!access) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const links = await listDocumentLinks(id, session)

  return Response.json(links, {
    headers: { 'Cache-Control': 'private, max-age=15' },
  })
}

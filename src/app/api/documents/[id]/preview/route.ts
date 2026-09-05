import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { documentExcerpt } from '@/lib/document-preview'
import { getDocument, listAncestors } from '@/lib/documents'

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

  const ancestors = await listAncestors(id)

  return Response.json(
    {
      id: document.id,
      title: document.title,
      icon: document.icon,
      kind: document.kind,
      trail: ancestors.map((crumb) => crumb.title),
      excerpt: documentExcerpt(document.content),
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}

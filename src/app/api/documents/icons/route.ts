import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { documentIdsFromQuery } from '@/lib/document-links'
import { listDocumentLinkTargets } from '@/lib/documents'

const maxIdsPerRequest = 20

export async function GET(request: Request) {
  const session = await getSession()

  if (!session) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const ids = documentIdsFromQuery(url.searchParams.get('ids')).slice(
    0,
    maxIdsPerRequest,
  )

  if (ids.length === 0) {
    return Response.json({ targets: [] })
  }

  const allowed = await Promise.all(
    ids.map(async (id) =>
      (await getDocumentAccess(id, session)) === null ? null : id,
    ),
  )

  const targets = await listDocumentLinkTargets(
    allowed.filter((id): id is string => id !== null),
  )

  return Response.json(
    { targets },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}

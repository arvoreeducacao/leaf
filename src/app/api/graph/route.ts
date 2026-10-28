import { getSession } from '@/lib/auth'
import { organizationGraph } from '@/lib/document-link-graph'
import { scheduleSearchIndexReconcile } from '@/lib/search-index'

export async function GET() {
  const session = await getSession()

  if (!session) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  scheduleSearchIndexReconcile()

  const graph = await organizationGraph({
    userId: session.user.id,
    email: session.user.email,
  })

  return Response.json(graph, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}

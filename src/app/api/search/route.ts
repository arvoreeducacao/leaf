import { getSession } from '@/lib/auth'
import { searchDocumentsHybrid } from '@/lib/search-hybrid'
import type { WorkspaceSearchResult } from '@/lib/search-index'
import {
  listRecentAccessibleDocuments,
  scheduleSearchIndexReconcile,
} from '@/lib/search-index'

function json(result: WorkspaceSearchResult) {
  return Response.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: Request) {
  const session = await getSession()

  if (!session) {
    return json({ documents: [], recent: false })
  }

  const viewer = {
    userId: session.user.id,
    email: session.user.email,
  }

  const term = (new URL(request.url).searchParams.get('q') ?? '').trim()

  scheduleSearchIndexReconcile()

  if (term.length === 0) {
    return json({
      documents: await listRecentAccessibleDocuments(viewer),
      recent: true,
    })
  }

  return json({
    documents: await searchDocumentsHybrid(viewer, term),
    recent: false,
  })
}

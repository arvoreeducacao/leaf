'use server'

import { getSession } from '@/lib/auth'
import type { SearchHit } from '@/lib/search-index'
import {
  listRecentAccessibleDocuments,
  searchAccessibleDocuments,
} from '@/lib/search-index'

export type WorkspaceSearchResult = Readonly<{
  documents: Array<SearchHit>
  recent: boolean
}>

export async function searchWorkspace(
  query: string,
): Promise<WorkspaceSearchResult> {
  const session = await getSession()

  if (!session) {
    return { documents: [], recent: false }
  }

  const viewer = {
    userId: session.user.id,
    email: session.user.email,
  }

  const term = query.trim()

  if (term.length === 0) {
    return { documents: listRecentAccessibleDocuments(viewer), recent: true }
  }

  return { documents: searchAccessibleDocuments(viewer, term), recent: false }
}

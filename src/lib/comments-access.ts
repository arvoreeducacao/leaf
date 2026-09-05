import type { AccessLevel } from '@/lib/authz'
import { canComment, canEdit } from '@/lib/authz'
import { countOpenComments, listDocumentComments } from '@/lib/comments'
import type { CommentsState } from '@/lib/comments-state'

export async function readCommentsState(
  documentId: string,
  access: AccessLevel,
  viewerId: string,
): Promise<CommentsState> {
  return {
    threads: await listDocumentComments(documentId),
    viewerId,
    canComment: canComment(access),
    canResolveAny: canEdit(access),
    openCount: await countOpenComments(documentId),
  }
}

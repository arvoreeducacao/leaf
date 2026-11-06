import { DocumentEditor } from '@/components/editor/document-editor'
import { isAiEnabled } from '@/lib/ai-config'
import { authorNameOf } from '@/lib/author-name'
import { getSession } from '@/lib/auth'
import { canComment, canEdit, getDocumentAccess } from '@/lib/authz'
import { readCommentsState } from '@/lib/comments-access'
import { documentIdsInContent } from '@/lib/document-links'
import { getDocument, listDocumentLinkTargets } from '@/lib/documents'
import { authIssuer as appBaseUrl } from '@/lib/mcp-config'
import { isRealtimeEnabled, realtimePort } from '@/lib/realtime-config'

import { RowPeekSheet } from './row-peek-sheet'
import { RowPropertiesSurface } from './row-properties-surface'

type Props = Readonly<{ rowId: string }>

export async function RowPeek({ rowId }: Props) {
  const session = await getSession()

  if (!session) {
    return null
  }

  const [access, document] = await Promise.all([
    getDocumentAccess(rowId, session),
    getDocument(rowId),
  ])

  if (
    !access ||
    !document ||
    document.deletedAt !== null ||
    document.kind !== 'row'
  ) {
    return null
  }

  const [comments, linkedDocuments] = await Promise.all([
    readCommentsState(document.id, access, session.user.id),
    listDocumentLinkTargets(
      documentIdsInContent(document.content, appBaseUrl()),
    ),
  ])

  const name =
    authorNameOf(session.user.name, session.user.email) ?? session.user.email
  const editable = canEdit(access)

  return (
    <RowPeekSheet
      canEdit={editable}
      icon={document.icon}
      rowId={document.id}
      title={document.title}
    >
      <div className="flex flex-col gap-2 pt-4 pb-24">
        <div className="px-4 tablet:px-[54px]">
          <RowPropertiesSurface canEdit={editable} inPeek rowId={document.id} />
        </div>
        <DocumentEditor
          aiEnabled={isAiEnabled()}
          canComment={canComment(access)}
          documentId={document.id}
          initialContent={document.content}
          initialUpdatedAt={new Date(document.updatedAt).getTime()}
          inlineNotice
          isOwner={access === 'owner'}
          linkedDocuments={linkedDocuments}
          openCommentCount={comments.openCount}
          readOnly={!editable}
          realtime={
            isRealtimeEnabled()
              ? {
                  url: process.env.LEAF_REALTIME_URL?.trim() || null,
                  port: realtimePort(),
                  user: {
                    id: session.user.id,
                    name: name ?? '',
                    image: session.user.image ?? null,
                  },
                }
              : null
          }
          viewer={{
            id: session.user.id,
            image: session.user.image ?? null,
            name,
          }}
        />
      </div>
    </RowPeekSheet>
  )
}

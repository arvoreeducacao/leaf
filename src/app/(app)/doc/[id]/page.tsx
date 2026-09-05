import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import type { ActiveTrailScope } from '@/components/app/active-trail-bridge'
import { ActiveTrail } from '@/components/app/active-trail'
import { DocumentBreadcrumb } from '@/components/app/document-breadcrumb'
import { DocumentCover } from '@/components/app/document-cover'
import { DocumentHeader } from '@/components/app/document-header'
import { DatabaseSurface } from '@/components/database/database-surface'
import { RowPropertiesSurface } from '@/components/database/row-properties-surface'
import { DocumentEditor } from '@/components/editor/document-editor'
import { isAiEnabled } from '@/lib/ai-config'
import { authorNameOf } from '@/lib/author-name'
import { getSession } from '@/lib/auth'
import { canComment, canEdit, getDocumentAccess } from '@/lib/authz'
import { countOpenComments } from '@/lib/comments'
import { parseCoverCredit } from '@/lib/document-cover'
import { documentIdsInContent } from '@/lib/document-links'
import {
  getDocument,
  listAncestors,
  listDocumentLinkTargets,
} from '@/lib/documents'
import { isRealtimeEnabled, realtimePort } from '@/lib/realtime-config'
import { getTeamspace } from '@/lib/teamspaces'
import { isUnsplashEnabled } from '@/lib/unsplash'
import { cn } from '@/shared/utils'

type Props = Readonly<{ params: Promise<{ id: string }> }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const document = await getDocument(id)
  const t = await getTranslations('metadata')

  return {
    title: document ? t('document', { title: document.title }) : t('title'),
  }
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const access = await getDocumentAccess(id, session)

  if (!access) {
    notFound()
  }

  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const [crumbs, openComments, teamspace, linkedDocuments] = await Promise.all([
    listAncestors(document.id),
    countOpenComments(document.id),
    document.teamspaceId ? getTeamspace(document.teamspaceId) : null,
    listDocumentLinkTargets(documentIdsInContent(document.content)),
  ])

  const scope: ActiveTrailScope = document.teamspaceId
    ? { id: document.teamspaceId, kind: 'teamspace' }
    : document.orgAccess !== null
      ? { kind: 'organization' }
      : document.ownerId === session.user.id
        ? { kind: 'private' }
        : { kind: 'none' }

  const isDatabase = document.kind === 'database'
  const hasCover = document.cover !== null

  return (
    <>
      <ActiveTrail
        trail={{
          documentId: document.id,
          nodes: [
            ...crumbs,
            {
              icon: document.icon,
              id: document.id,
              kind: document.kind,
              title: document.title,
            },
          ],
          scope,
        }}
      />
      {document.cover ? (
        <DocumentCover
          canEdit={canEdit(access)}
          cover={document.cover}
          credit={parseCoverCredit(document.coverCredit)}
          documentId={document.id}
          position={document.coverPosition}
          unsplashEnabled={isUnsplashEnabled()}
        />
      ) : null}
      <article
        className={cn(
          isDatabase
            ? 'flex w-full min-w-0 flex-col gap-1 pb-40'
            : 'mx-auto flex w-full max-w-page flex-col gap-2 pb-40',
          isDatabase && (hasCover ? 'pt-4 tablet:pt-6' : 'pt-6 tablet:pt-9'),
          !isDatabase && (hasCover ? 'pt-6 tablet:pt-10' : 'pt-10 tablet:pt-20'),
        )}
      >
        <DocumentHeader
          breadcrumb={
            crumbs.length > 0 ? <DocumentBreadcrumb crumbs={crumbs} /> : null
          }
          canEdit={canEdit(access)}
          canMoveToTeamspace={access === 'owner' && document.orgId !== null}
          documentId={document.id}
          hasCover={hasCover}
          icon={document.icon}
          isOwner={access === 'owner'}
          kind={document.kind}
          openComments={openComments}
          sharedWithOrganization={document.orgAccess !== null}
          teamspaceName={teamspace?.name ?? null}
          title={document.title}
          updatedAt={document.updatedAt}
          wide={isDatabase}
        />
        {isDatabase ? (
          <DatabaseSurface canEdit={canEdit(access)} databaseId={document.id} />
        ) : (
          <>
            {document.kind === 'row' ? (
              <div className="px-4 tablet:px-[54px]">
                <RowPropertiesSurface
                  canEdit={canEdit(access)}
                  rowId={document.id}
                />
              </div>
            ) : null}
            <DocumentEditor
              aiEnabled={isAiEnabled()}
              canComment={canComment(access)}
              documentId={document.id}
              initialContent={document.content}
              initialUpdatedAt={new Date(document.updatedAt).getTime()}
              isOwner={access === 'owner'}
              linkedDocuments={linkedDocuments}
              openCommentCount={openComments}
              readOnly={!canEdit(access)}
              realtime={
                isRealtimeEnabled()
                  ? {
                      url: process.env.LEAF_REALTIME_URL?.trim() || null,
                      port: realtimePort(),
                      user: {
                        id: session.user.id,
                        name:
                          authorNameOf(session.user.name, session.user.email) ??
                          '',
                        image: session.user.image ?? null,
                      },
                    }
                  : null
              }
            />
          </>
        )}
      </article>
    </>
  )
}

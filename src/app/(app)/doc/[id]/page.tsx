import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { DocumentBreadcrumb } from '@/components/app/document-breadcrumb'
import { DocumentHeader } from '@/components/app/document-header'
import { DocumentEditor } from '@/components/editor/document-editor'
import { authorNameOf } from '@/lib/author-name'
import { getSession } from '@/lib/auth'
import { canComment, canEdit, getDocumentAccess } from '@/lib/authz'
import { countOpenComments } from '@/lib/comments'
import { getDocument, listAncestors } from '@/lib/documents'
import { isRealtimeEnabled, realtimePort } from '@/lib/realtime-config'
import { getTeamspace } from '@/lib/teamspaces'

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

  const crumbs = await listAncestors(document.id)
  const openComments = await countOpenComments(document.id)
  const teamspace = document.teamspaceId
    ? await getTeamspace(document.teamspaceId)
    : null

  return (
    <article className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8 tablet:px-8 tablet:py-10">
      <DocumentBreadcrumb crumbs={crumbs} />
      <DocumentHeader
        canEdit={canEdit(access)}
        canMoveToTeamspace={access === 'owner' && document.orgId !== null}
        documentId={document.id}
        isOwner={access === 'owner'}
        openComments={openComments}
        sharedWithOrganization={document.orgAccess !== null}
        teamspaceName={teamspace?.name ?? null}
        title={document.title}
      />
      <div className="mx-auto w-full max-w-prose-leaf">
        <DocumentEditor
          canComment={canComment(access)}
          documentId={document.id}
          initialContent={document.content}
          isOwner={access === 'owner'}
          readOnly={!canEdit(access)}
          realtime={
            isRealtimeEnabled()
              ? {
                  url: process.env.LEAF_REALTIME_URL?.trim() || null,
                  port: realtimePort(),
                  user: {
                    id: session.user.id,
                    name:
                      authorNameOf(session.user.name, session.user.email) ?? '',
                  },
                }
              : null
          }
        />
      </div>
    </article>
  )
}

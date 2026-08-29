import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { DocumentBreadcrumb } from '@/components/app/document-breadcrumb'
import { DocumentHeader } from '@/components/app/document-header'
import { DocumentEditor } from '@/components/editor/document-editor'
import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { getDocument, listAncestors } from '@/lib/documents'

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

  return (
    <article className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8 tablet:px-8 tablet:py-10">
      <DocumentBreadcrumb crumbs={crumbs} />
      <DocumentHeader
        canEdit={canEdit(access)}
        documentId={document.id}
        isOwner={access === 'owner'}
        title={document.title}
      />
      <div className="mx-auto w-full max-w-prose-leaf">
        <DocumentEditor
          documentId={document.id}
          initialContent={document.content}
          readOnly={!canEdit(access)}
        />
      </div>
    </article>
  )
}

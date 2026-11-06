'use client'

import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { DocumentNotice } from '@/components/app/document-notice'
import { WarningIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import type { CommentViewer } from '@/components/comments/comment-composer'

import type { LinkedDocumentIcon } from './doc-link-icons'
import { EditorSkeleton } from './editor-skeleton'
import { requestLocalCopyReset } from './status-bridge'
import { useDocumentSession } from './use-document-session'

const BlockNoteEditor = dynamic(() => import('./block-note-editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

export type RealtimeConfig = Readonly<{
  url: string | null
  port: number
  user: Readonly<{ id: string; name: string; image: string | null }>
}>

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  initialUpdatedAt: number | null
  readOnly: boolean
  isOwner: boolean
  canComment: boolean
  openCommentCount: number
  viewer: CommentViewer
  realtime: RealtimeConfig | null
  aiEnabled: boolean
  linkedDocuments: ReadonlyArray<LinkedDocumentIcon>
  inlineNotice?: boolean
}>

export function DocumentEditor({
  documentId,
  initialContent,
  initialUpdatedAt,
  readOnly,
  isOwner,
  canComment,
  openCommentCount,
  viewer,
  realtime,
  aiEnabled,
  linkedDocuments,
  inlineNotice = false,
}: Props) {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('realtime')
  const tOffline = useTranslations('offline')
  const [wasReadOnly, setWasReadOnly] = useState(readOnly)
  const [accessChanged, setAccessChanged] = useState(false)
  const refresh = useCallback(() => router.refresh(), [router])
  const {
    phase,
    session,
    connection,
    seed,
    conflict,
    localOnly,
    waiting,
    trashed,
  } = useDocumentSession({
    realtimeEnabled: realtime !== null,
    documentId,
    url: realtime?.url ?? null,
    port: realtime?.port ?? 0,
    user: realtime?.user ?? { id: '', name: '', image: null },
    anonymousName: t('someone'),
    fallbackContent: initialContent,
    fallbackUpdatedAt: initialUpdatedAt,
    onAccessChange: refresh,
  })

  if (readOnly !== wasReadOnly) {
    setWasReadOnly(readOnly)
    setAccessChanged(readOnly)
  }

  useEffect(() => {
    if (accessChanged) {
      requestLocalCopyReset()
    }
  }, [accessChanged])

  const notice = (
    <DocumentNotice
      accessChanged={accessChanged}
      connection={connection}
      documentId={documentId}
      inline={inlineNotice}
      isOwner={isOwner}
      onDismissAccessChange={() => setAccessChanged(false)}
      trashed={trashed}
    />
  )

  if (phase === 'unavailable') {
    return (
      <Alert variant="warning">
        <WarningIcon aria-hidden="true" />
        <AlertTitle>
          <h2>{tOffline('documentUnavailableTitle')}</h2>
        </AlertTitle>
        <AlertDescription>
          <p>{tOffline('documentUnavailableBody')}</p>
        </AlertDescription>
      </Alert>
    )
  }

  if (session === null) {
    return (
      <>
        {notice}
        <EditorSkeleton />
      </>
    )
  }

  return (
    <>
      {notice}
      <BlockNoteEditor
        aiEnabled={aiEnabled}
        canComment={canComment}
        collaboration={session}
        conflict={conflict}
        connection={connection}
        directSave={realtime === null}
        documentId={documentId}
        initialContent={initialContent}
        isOwner={isOwner}
        key={`${locale}:${session.provider === null ? 'local' : 'live'}`}
        linkedDocuments={linkedDocuments}
        localOnly={localOnly}
        openCommentCount={openCommentCount}
        readOnly={readOnly || waiting || trashed}
        seed={seed}
        viewer={viewer}
      />
    </>
  )
}

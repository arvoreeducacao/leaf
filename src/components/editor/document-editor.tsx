'use client'

import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

import { WarningIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { EditorSkeleton } from './editor-skeleton'
import { useDocumentSession } from './use-document-session'

const BlockNoteEditor = dynamic(() => import('./block-note-editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

export type RealtimeConfig = Readonly<{
  url: string | null
  port: number
  user: Readonly<{ id: string; name: string }>
}>

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  readOnly: boolean
  isOwner: boolean
  canComment: boolean
  openCommentCount: number
  realtime: RealtimeConfig | null
  aiEnabled: boolean
}>

export function DocumentEditor({
  documentId,
  initialContent,
  readOnly,
  isOwner,
  canComment,
  openCommentCount,
  realtime,
  aiEnabled,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('realtime')
  const tOffline = useTranslations('offline')
  const { phase, session, connection, seed, conflict, localOnly } =
    useDocumentSession({
      realtimeEnabled: realtime !== null,
      documentId,
      url: realtime?.url ?? null,
      port: realtime?.port ?? 0,
      user: realtime?.user ?? { id: '', name: '' },
      anonymousName: t('someone'),
      fallbackContent: initialContent,
    })

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
    return <EditorSkeleton />
  }

  return (
    <BlockNoteEditor
      aiEnabled={aiEnabled}
      canComment={canComment}
      collaboration={session}
      conflict={conflict}
      connection={connection}
      documentId={documentId}
      initialContent={initialContent}
      isOwner={isOwner}
      key={`${locale}:${session.provider === null ? 'local' : 'live'}`}
      localOnly={localOnly}
      openCommentCount={openCommentCount}
      readOnly={readOnly}
      seed={seed}
    />
  )
}

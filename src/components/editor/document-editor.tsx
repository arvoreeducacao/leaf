'use client'

import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

import { EditorSkeleton } from './editor-skeleton'
import { useRealtimeSession } from './use-realtime-session'

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
  realtime: RealtimeConfig | null
}>

export function DocumentEditor({
  documentId,
  initialContent,
  readOnly,
  isOwner,
  canComment,
  realtime,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('realtime')
  const { phase, session, connected } = useRealtimeSession({
    enabled: realtime !== null,
    documentId,
    url: realtime?.url ?? null,
    port: realtime?.port ?? 0,
    user: realtime?.user ?? { id: '', name: '' },
    anonymousName: t('someone'),
  })

  if (realtime && phase === 'connecting') {
    return <EditorSkeleton />
  }

  return (
    <BlockNoteEditor
      canComment={canComment}
      collaboration={session}
      documentId={documentId}
      initialContent={initialContent}
      isOwner={isOwner}
      key={locale}
      readOnly={readOnly}
      realtimeConnected={connected}
    />
  )
}

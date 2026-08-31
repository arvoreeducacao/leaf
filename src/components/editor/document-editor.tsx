'use client'

import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'

import { EditorSkeleton } from './editor-skeleton'

const BlockNoteEditor = dynamic(() => import('./block-note-editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  readOnly: boolean
  isOwner: boolean
  canComment: boolean
}>

export function DocumentEditor({
  documentId,
  initialContent,
  readOnly,
  isOwner,
  canComment,
}: Props) {
  const locale = useLocale()

  return (
    <BlockNoteEditor
      canComment={canComment}
      documentId={documentId}
      initialContent={initialContent}
      isOwner={isOwner}
      key={locale}
      readOnly={readOnly}
    />
  )
}

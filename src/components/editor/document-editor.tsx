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
}>

export function DocumentEditor({ documentId, initialContent, readOnly }: Props) {
  const locale = useLocale()

  return (
    <BlockNoteEditor
      documentId={documentId}
      initialContent={initialContent}
      key={locale}
      readOnly={readOnly}
    />
  )
}

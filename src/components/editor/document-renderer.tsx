'use client'

import dynamic from 'next/dynamic'

import { EditorSkeleton } from './editor-skeleton'

const BlockNoteRenderer = dynamic(() => import('./block-note-renderer'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
})

type Props = Readonly<{ content: string | null }>

export function DocumentRenderer({ content }: Props) {
  return <BlockNoteRenderer content={content} />
}

'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useTheme } from 'next-themes'

import { parseDocumentContent } from './content'
import { leafSchema } from './schema'
import { useLeafDictionary } from './use-leaf-dictionary'

type Props = Readonly<{ content: string | null }>

export default function BlockNoteRenderer({ content }: Props) {
  const { resolvedTheme } = useTheme()
  const { dictionary } = useLeafDictionary(true)
  const editor = useCreateBlockNote({
    schema: leafSchema,
    dictionary,
    initialContent: parseDocumentContent(content),
  })

  return (
    <BlockNoteView
      className="leaf-editor"
      editable={false}
      editor={editor}
      emojiPicker={false}
      filePanel={false}
      formattingToolbar={false}
      sideMenu={false}
      slashMenu={false}
      tableHandles={false}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  )
}

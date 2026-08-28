'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'

import { parseDocumentContent } from './content'
import { leafReadOnlyDictionary } from './dictionary'
import { leafSchema } from './schema'

type Props = Readonly<{ content: string | null }>

export default function BlockNoteRenderer({ content }: Props) {
  const editor = useCreateBlockNote({
    schema: leafSchema,
    dictionary: leafReadOnlyDictionary,
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
    />
  )
}

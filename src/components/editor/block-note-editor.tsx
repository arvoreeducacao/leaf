'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { filterSuggestionItems } from '@blocknote/core'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useCallback } from 'react'

import { EyeIcon } from '@/components/icons'

import { parseDocumentContent } from './content'
import { leafDictionary } from './dictionary'
import { SaveIndicator } from './save-indicator'
import { leafSchema } from './schema'
import { getLeafSlashMenuItems } from './slash-menu-items'
import { uploadEditorFile } from './upload-file'
import { useAutosave } from './use-autosave'

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  readOnly: boolean
}>

export default function BlockNoteEditor({
  documentId,
  initialContent,
  readOnly,
}: Props) {
  const { status, schedule, flush } = useAutosave(documentId, !readOnly)

  const editor = useCreateBlockNote({
    schema: leafSchema,
    dictionary: leafDictionary,
    initialContent: parseDocumentContent(initialContent),
    uploadFile: uploadEditorFile,
  })

  const handleChange = useCallback(() => {
    schedule(JSON.stringify(editor.document))
  }, [editor, schedule])

  const handleBlur = useCallback(() => {
    void flush()
  }, [flush])

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex min-h-6 items-center justify-end px-8 tablet:px-14">
        {readOnly ? (
          <p className="flex items-center gap-2 text-body-small text-gray-600">
            <EyeIcon aria-hidden="true" className="size-4" />
            Somente leitura
          </p>
        ) : (
          <SaveIndicator status={status} />
        )}
      </div>
      <BlockNoteView
        className="leaf-editor"
        editable={!readOnly}
        editor={editor}
        emojiPicker={false}
        onBlur={handleBlur}
        onChange={handleChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          getItems={async (query) =>
            filterSuggestionItems(getLeafSlashMenuItems(editor), query)
          }
          triggerCharacter="/"
        />
      </BlockNoteView>
    </div>
  )
}

'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { filterSuggestionItems } from '@blocknote/core'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useCallback, useId } from 'react'

import { EyeIcon, WarningIcon } from '@/components/icons'

import { readDocumentContent } from './content'
import { leafDictionary } from './dictionary'
import { LeafFormattingToolbarController } from './formatting-toolbar'
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
  const readOnlyHintId = useId()
  const parsed = readDocumentContent(initialContent)
  const isUnreadable = parsed.status === 'unreadable'
  const isEditable = !readOnly && !isUnreadable

  const { status, schedule, flush } = useAutosave(documentId, isEditable)

  const editor = useCreateBlockNote({
    schema: leafSchema,
    dictionary: leafDictionary,
    initialContent: parsed.status === 'ok' ? parsed.blocks : undefined,
    uploadFile: uploadEditorFile,
    domAttributes: readOnly
      ? { editor: { 'aria-describedby': readOnlyHintId } }
      : undefined,
  })

  const handleChange = useCallback(() => {
    schedule(JSON.stringify(editor.document))
  }, [editor, schedule])

  const handleBlur = useCallback(() => {
    void flush()
  }, [flush])

  if (isUnreadable) {
    return (
      <section
        className="flex items-start gap-3 rounded-xlarge bg-error-50 p-6"
        role="alert"
      >
        <WarningIcon
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-error-700"
        />
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-body-medium text-gray-900">
            Não foi possível abrir este documento
          </h2>
          <p className="text-body-small text-gray-700">
            O conteúdo salvo está num formato que o editor não reconhece. A
            edição ficou bloqueada para não sobrescrever o original. Fale com o
            suporte antes de mexer neste documento.
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex min-h-6 items-center justify-end px-8 tablet:px-14">
        {readOnly ? (
          <p
            className="flex items-center gap-2 text-body-small text-gray-700"
            id={readOnlyHintId}
          >
            <EyeIcon aria-hidden="true" className="size-4" />
            Somente leitura
          </p>
        ) : (
          <SaveIndicator onRetry={() => void flush()} status={status} />
        )}
      </div>
      <BlockNoteView
        className="leaf-editor"
        editable={isEditable}
        editor={editor}
        emojiPicker={false}
        formattingToolbar={false}
        onBlur={handleBlur}
        onChange={handleChange}
        slashMenu={false}
      >
        <LeafFormattingToolbarController />
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

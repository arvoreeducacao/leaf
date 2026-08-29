'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { filterSuggestionItems } from '@blocknote/core'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { EyeIcon, WarningIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { readDocumentContent } from './content'
import { DocumentStats } from './document-stats'
import { focusDocumentTitle, onEditorFocusRequest } from './focus-bridge'
import { LeafFormattingToolbarController } from './formatting-toolbar'
import { SaveIndicator } from './save-indicator'
import { leafSchema } from './schema'
import { getLeafSlashMenuItems } from './slash-menu-items'
import { statsFromBlocks } from './text-stats'
import { uploadEditorFile } from './upload-file'
import { useAutosave } from './use-autosave'
import { useLeafDictionary } from './use-leaf-dictionary'

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
  const t = useTranslations('editor')
  const { resolvedTheme } = useTheme()
  const { calloutItem, dictionary } = useLeafDictionary(readOnly)
  const readOnlyHintId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const parsed = readDocumentContent(initialContent)
  const isUnreadable = parsed.status === 'unreadable'
  const isEditable = !readOnly && !isUnreadable

  const { status, schedule, flush } = useAutosave(documentId, isEditable)

  const editor = useCreateBlockNote({
    schema: leafSchema,
    dictionary,
    initialContent: parsed.status === 'ok' ? parsed.blocks : undefined,
    uploadFile: (file: File) => uploadEditorFile(file, t('uploadFailed')),
    domAttributes: readOnly
      ? { editor: { 'aria-describedby': readOnlyHintId } }
      : undefined,
  })

  const [stats, setStats] = useState(() =>
    statsFromBlocks(parsed.status === 'ok' ? parsed.blocks : []),
  )

  const handleChange = useCallback(() => {
    const blocks = editor.document

    setStats(statsFromBlocks(blocks))
    schedule(JSON.stringify(blocks))
  }, [editor, schedule])

  const handleBlur = useCallback(() => {
    void flush()
  }, [flush])

  useEffect(() => {
    const element = containerRef.current

    if (!isEditable || !element) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Backspace') {
        return
      }

      const first = editor.document[0]
      const cursor = editor.getTextCursorPosition()

      if (!first || cursor.block.id !== first.id) {
        return
      }

      if (statsFromBlocks([cursor.block]).characters > 0) {
        return
      }

      if (focusDocumentTitle()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    element.addEventListener('keydown', handleKeyDown, true)

    return () => {
      element.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editor, isEditable])

  useEffect(
    () =>
      onEditorFocusRequest(() => {
        const first = editor.document[0]

        if (!first) {
          return
        }

        editor.setTextCursorPosition(first, 'start')
        editor.focus()
      }),
    [editor],
  )

  if (isUnreadable) {
    return (
      <Alert variant="error">
        <WarningIcon aria-hidden="true" />
        <AlertTitle>
          <h2>{t('unreadableTitle')}</h2>
        </AlertTitle>
        <AlertDescription>
          <p>{t('unreadableBody')}</p>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2" ref={containerRef}>
      <div className="flex min-h-6 items-center justify-end px-8 tablet:px-14">
        {readOnly ? (
          <p
            className="flex items-center gap-2 text-body-small text-content"
            id={readOnlyHintId}
          >
            <EyeIcon aria-hidden="true" className="size-4" />
            {t('readOnly')}
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
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      >
        <LeafFormattingToolbarController />
        <SuggestionMenuController
          getItems={async (query) =>
            filterSuggestionItems(
              getLeafSlashMenuItems(editor, calloutItem),
              query,
            )
          }
          triggerCharacter="/"
        />
      </BlockNoteView>
      <div className="flex justify-end px-8 tablet:px-14">
        <DocumentStats stats={stats} />
      </div>
    </div>
  )
}

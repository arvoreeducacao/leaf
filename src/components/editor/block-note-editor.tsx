'use client'

import '@blocknote/shadcn/style.css'
import './editor.css'

import { filterSuggestionItems } from '@blocknote/core'
import { withCollaboration } from '@blocknote/core/yjs'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  onDocumentImportRequest,
  pendingImportFlag,
  setImportAvailability,
} from '@/components/app/palette-bridge'
import {
  onCommentedBlockFocus,
  publishBlockIds,
  resetBlockIds,
} from '@/components/comments/comments-bridge'
import { InlineComments } from '@/components/comments/inline-comments'
import { WarningIcon } from '@/components/icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { createDatabase } from '@/lib/database-actions'
import { takeSessionFlag } from '@/shared/storage'

import { collectBlockIds } from './block-ids'
import { readDocumentContent } from './content'
import { DocumentImport } from './document-import'
import type { DocumentImportHandle } from './document-import'
import { focusDocumentTitle, onEditorFocusRequest } from './focus-bridge'
import { LeafFormattingToolbarController } from './formatting-toolbar'
import { renderRealtimeCursor } from './realtime-cursor'
import {
  onSaveRetryRequest,
  publishEditorStatus,
  readOnlyHintId,
  resetEditorStatus,
} from './status-bridge'
import type { RealtimeSession } from './use-realtime-session'
import { leafSchema } from './schema'
import { getLeafSlashMenuItems } from './slash-menu-items'
import { statsFromBlocks } from './text-stats'
import { uploadEditorFile } from './upload-file'
import { useAutosave } from './use-autosave'
import { useLeafDictionary } from './use-leaf-dictionary'

const highlightDuration = 2_200
const blockIdPattern = /^[A-Za-z0-9_-]+$/

function highlightRule(blockId: string) {
  return `.leaf-editor .bn-block-outer[data-id="${blockId}"]{border-radius:var(--radius-medium);background-color:var(--warn-surface);box-shadow:0 0 0 2px var(--warn);}`
}

type Props = Readonly<{
  documentId: string
  initialContent: string | null
  readOnly: boolean
  isOwner: boolean
  canComment: boolean
  openCommentCount: number
  collaboration?: RealtimeSession | null
  realtimeConnected?: boolean
}>

export default function BlockNoteEditor({
  documentId,
  initialContent,
  readOnly,
  isOwner,
  canComment,
  openCommentCount,
  collaboration = null,
  realtimeConnected = false,
}: Props) {
  const t = useTranslations('editor')
  const tComments = useTranslations('comments')
  const tImport = useTranslations('importFile')
  const tDatabase = useTranslations('database')
  const tRealtime = useTranslations('realtime')
  const { resolvedTheme } = useTheme()
  const { calloutItem, databaseItem, dictionary } = useLeafDictionary(readOnly)
  const containerRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<DocumentImportHandle>(null)
  const parsed = readDocumentContent(initialContent)
  const isUnreadable = parsed.status === 'unreadable'
  const isEditable = !readOnly && !isUnreadable

  const { status, schedule, flush } = useAutosave(
    documentId,
    isEditable && collaboration === null,
  )

  const baseOptions = {
    schema: leafSchema,
    dictionary,
    initialContent:
      collaboration === null && parsed.status === 'ok'
        ? parsed.blocks
        : undefined,
    uploadFile: (file: File) => uploadEditorFile(file, t('uploadFailed')),
    domAttributes: readOnly
      ? { editor: { 'aria-describedby': readOnlyHintId } }
      : undefined,
  }

  const cursorTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const anonymousName = tRealtime('someone')

  const editor = useCreateBlockNote(
    collaboration
      ? withCollaboration({
          ...baseOptions,
          collaboration: {
            fragment: collaboration.fragment,
            provider: collaboration.provider,
            user: collaboration.user,
            showCursorLabels: 'activity',
            renderCursor: (cursorUser) =>
              renderRealtimeCursor(cursorUser, cursorTheme, anonymousName),
          },
        })
      : baseOptions,
  )

  const [highlightedBlock, setHighlightedBlock] = useState<string | null>(null)

  const [stats, setStats] = useState(() =>
    statsFromBlocks(parsed.status === 'ok' ? parsed.blocks : []),
  )

  const handleChange = useCallback(() => {
    const blocks = editor.document

    setStats(statsFromBlocks(blocks))
    publishBlockIds(collectBlockIds(blocks))
    schedule(JSON.stringify(blocks))
  }, [editor, schedule])

  const handleBlur = useCallback(() => {
    void flush()
  }, [flush])

  const insertImportedBlocks = useCallback(
    (serialized: string) => {
      const blocks = JSON.parse(serialized) as Parameters<
        typeof editor.insertBlocks
      >[0]
      const reference = editor.getTextCursorPosition().block

      editor.insertBlocks(blocks, reference, 'after')
      handleChange()
    },
    [editor, handleChange],
  )

  const insertDatabase = useCallback(() => {
    void (async () => {
      try {
        const result = await createDatabase(documentId)

        if (!result.ok) {
          toast.error(result.error)

          return
        }

        const reference = editor.getTextCursorPosition().block

        editor.insertBlocks(
          [{ type: 'database', props: { databaseId: result.id } }],
          reference,
          'after',
        )
        handleChange()
      } catch {
        toast.error(tDatabase('newDatabaseFailed'))
      }
    })()
  }, [documentId, editor, handleChange, tDatabase])

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

  useEffect(() => {
    publishBlockIds(collectBlockIds(editor.document))

    return () => resetBlockIds()
  }, [editor])

  useEffect(() => {
    publishEditorStatus({
      ready: true,
      readOnly,
      save: status,
      stats,
      realtime: collaboration
        ? realtimeConnected
          ? 'connected'
          : 'reconnecting'
        : 'off',
    })
  }, [collaboration, readOnly, realtimeConnected, stats, status])

  useEffect(() => resetEditorStatus, [])

  useEffect(() => onSaveRetryRequest(() => void flush()), [flush])

  useEffect(() => {
    if (!isEditable) {
      return
    }

    setImportAvailability(true)

    const stop = onDocumentImportRequest(() =>
      importRef.current?.pickMarkdown(),
    )

    if (takeSessionFlag(pendingImportFlag) !== null) {
      importRef.current?.pickMarkdown()
    }

    return () => {
      setImportAvailability(false)
      stop()
    }
  }, [isEditable])

  const blockGoneRef = useRef(tComments('blockGone'))

  blockGoneRef.current = tComments('blockGone')

  useEffect(() => {
    let timeout = 0

    const stop = onCommentedBlockFocus((blockId) => {
      const target = containerRef.current?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(blockId)}"]`,
      )

      if (!target) {
        toast.error(blockGoneRef.current)

        return
      }

      if (timeout !== 0) {
        window.clearTimeout(timeout)
      }

      const reduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

      target.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      })

      setHighlightedBlock(blockId)
      timeout = window.setTimeout(
        () => setHighlightedBlock(null),
        highlightDuration,
      )
    })

    return () => {
      stop()

      if (timeout !== 0) {
        window.clearTimeout(timeout)
      }
    }
  }, [])

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
    <div className="relative flex w-full flex-col" ref={containerRef}>
      {highlightedBlock && blockIdPattern.test(highlightedBlock) ? (
        <style>{highlightRule(highlightedBlock)}</style>
      ) : null}
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
        <LeafFormattingToolbarController canComment={canComment} />
        <SuggestionMenuController
          getItems={async (query) =>
            filterSuggestionItems(
              getLeafSlashMenuItems(
                editor,
                calloutItem,
                {
                  group: tImport('slashGroup'),
                  markdown: tImport('slashMarkdown'),
                  markdownHint: tImport('slashMarkdownHint'),
                  archive: tImport('slashArchive'),
                  archiveHint: tImport('slashArchiveHint'),
                  link: tImport('slashLink'),
                  linkHint: tImport('slashLinkHint'),
                },
                {
                  onArchive: isOwner
                    ? () => importRef.current?.pickArchive()
                    : undefined,
                  onLink: isOwner
                    ? () => importRef.current?.pickLink()
                    : undefined,
                  onMarkdown: () => importRef.current?.pickMarkdown(),
                },
                { ...databaseItem, onInsert: insertDatabase },
              ),
              query,
            )
          }
          triggerCharacter="/"
        />
      </BlockNoteView>
      <InlineComments
        containerRef={containerRef}
        documentId={documentId}
        initialOpenCount={openCommentCount}
      />
      {isEditable ? (
        <DocumentImport
          canImportArchive={isOwner}
          documentId={documentId}
          onBlocks={insertImportedBlocks}
          ref={importRef}
        />
      ) : null}
    </div>
  )
}

'use client'

import '@blocknote/shadcn/style.css'
import '@blocknote/xl-ai/style.css'
import './editor.css'

import { filterSuggestionItems } from '@blocknote/core'
import { withCollaboration } from '@blocknote/core/yjs'
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { AIMenu, AIMenuController } from '@blocknote/xl-ai'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

import { aiAgentName, createAiMenuTexts } from './ai-dictionary'
import { createLeafAiExtension } from './ai-extension'
import { createLeafAiMenuItems, leafAiSlashMenuItems } from './ai-menu-items'
import { collectBlockIds } from './block-ids'
import { BlockContextMenu } from './block-context-menu'
import { readDocumentContent } from './content'
import type { LinkedDocumentIcon } from './doc-link-icons'
import { DocumentImport } from './document-import'
import type { DocumentImportHandle } from './document-import'
import { focusDocumentTitle, onEditorFocusRequest } from './focus-bridge'
import { LeafFormattingToolbarController } from './formatting-toolbar'
import { LeafLinkToolbarController } from './link-toolbar'
import { renderRealtimeCursor } from './realtime-cursor'
import {
  onSaveRetryRequest,
  publishEditorStatus,
  readOnlyHintId,
  resetEditorStatus,
} from './status-bridge'
import type { ConnectionStatus } from './status-bridge'
import type { DocumentSession } from './use-document-session'
import { leafSchema } from './schema'
import { acceptsEmbedPaste, embeddablePastedUrl } from './embed-paste'
import { getLeafSlashMenuItems } from './slash-menu-items'
import { statsFromBlocks } from './text-stats'
import { uploadEditorFile } from './upload-file'
import { useAutosave } from './use-autosave'
import { useDocLinkIcons } from './use-doc-link-icons'
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
  collaboration: DocumentSession
  connection: ConnectionStatus
  seed: string | null
  conflict: boolean
  localOnly: boolean
  aiEnabled: boolean
  linkedDocuments: ReadonlyArray<LinkedDocumentIcon>
}>

export default function BlockNoteEditor({
  documentId,
  initialContent,
  readOnly,
  isOwner,
  canComment,
  openCommentCount,
  collaboration,
  connection,
  seed,
  conflict,
  localOnly,
  aiEnabled,
  linkedDocuments,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('editor')
  const tComments = useTranslations('comments')
  const tImport = useTranslations('importFile')
  const tDatabase = useTranslations('database')
  const tRealtime = useTranslations('realtime')
  const { resolvedTheme } = useTheme()
  const { calloutItem, databaseItem, embedItem, dictionary } =
    useLeafDictionary(readOnly)
  const containerRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<DocumentImportHandle>(null)
  const parsed = readDocumentContent(seed ?? initialContent)
  const isUnreadable = parsed.status === 'unreadable'
  const isEditable = !readOnly && !isUnreadable
  const canUseAi = aiEnabled && isEditable
  const seedBlocks = parsed.status === 'ok' ? parsed.blocks : null

  const { status, schedule, flush, markSaved } = useAutosave(
    documentId,
    isEditable && connection !== 'connected',
  )

  const cursorTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const anonymousName = tRealtime('someone')

  const editor = useCreateBlockNote(
    withCollaboration({
      schema: leafSchema,
      dictionary,
      extensions: canUseAi
        ? [createLeafAiExtension(documentId, aiAgentName(locale))]
        : [],
      uploadFile: (file: File) => uploadEditorFile(file, t('uploadFailed')),
      pasteHandler: ({ event, editor: current, defaultPasteHandler }) => {
        const url = embeddablePastedUrl(
          event.clipboardData?.getData('text/plain'),
        )
        const block = current.getTextCursorPosition().block

        if (url === null || !acceptsEmbedPaste(block)) {
          return defaultPasteHandler()
        }

        current.updateBlock(block, { props: { url }, type: 'embed' })

        return true
      },
      domAttributes: readOnly
        ? { editor: { 'aria-describedby': readOnlyHintId } }
        : undefined,
      collaboration: {
        fragment: collaboration.fragment,
        provider: collaboration.provider ?? undefined,
        user: collaboration.user,
        showCursorLabels: 'activity',
        renderCursor: (cursorUser) =>
          renderRealtimeCursor(cursorUser, cursorTheme, anonymousName),
      },
    }),
  )

  const [highlightedBlock, setHighlightedBlock] = useState<string | null>(null)
  const [stats, setStats] = useState(() => statsFromBlocks([]))
  const seededRef = useRef(false)

  const aiMenu = useMemo(() => {
    const items = createLeafAiMenuItems(createAiMenuTexts(locale))

    return function LeafAiMenu() {
      return <AIMenu items={items} />
    }
  }, [locale])

  const { css: docLinkIconCss, scan: scanDocLinks } = useDocLinkIcons({
    container: containerRef,
    initialTargets: linkedDocuments,
  })

  const handleChange = useCallback(() => {
    const blocks = editor.document

    setStats(statsFromBlocks(blocks))
    publishBlockIds(collectBlockIds(blocks))
    scanDocLinks()
    schedule(JSON.stringify(blocks))
  }, [editor, scanDocLinks, schedule])

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
    if (seed === null || seedBlocks === null || seededRef.current) {
      return
    }

    seededRef.current = true

    if (statsFromBlocks(editor.document).characters > 0) {
      return
    }

    editor.replaceBlocks(editor.document, seedBlocks)
    markSaved(JSON.stringify(editor.document))
    setStats(statsFromBlocks(editor.document))
  }, [editor, markSaved, seed, seedBlocks])

  useEffect(() => {
    setStats(statsFromBlocks(editor.document))
  }, [editor])

  useEffect(() => {
    if (!localOnly || !isEditable) {
      return
    }

    schedule(JSON.stringify(editor.document))
  }, [editor, isEditable, localOnly, schedule])

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
      connection,
      conflict,
    })
  }, [conflict, connection, readOnly, stats, status])

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
      {docLinkIconCss.length > 0 ? <style>{docLinkIconCss}</style> : null}
      {highlightedBlock && blockIdPattern.test(highlightedBlock) ? (
        <style>{highlightRule(highlightedBlock)}</style>
      ) : null}
      <BlockContextMenu
        editable={isEditable}
        editor={editor}
        labels={{
          duplicate: t('blockDuplicate'),
          remove: t('blockRemove'),
          turnInto: t('blockTurnInto'),
        }}
      >
        <BlockNoteView
          className="leaf-editor"
          editable={isEditable}
          editor={editor}
          emojiPicker={false}
          formattingToolbar={false}
          linkToolbar={false}
          onBlur={handleBlur}
          onChange={handleChange}
          slashMenu={false}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <LeafFormattingToolbarController
            canComment={canComment}
            canUseAi={canUseAi}
          />
          <LeafLinkToolbarController />
          {canUseAi ? <AIMenuController aiMenu={aiMenu} /> : null}
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
                  canUseAi ? leafAiSlashMenuItems(editor) : [],
                  embedItem,
                ),
                query,
              )
            }
            triggerCharacter="/"
          />
        </BlockNoteView>
      </BlockContextMenu>
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

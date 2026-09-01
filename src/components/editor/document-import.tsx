'use client'

import { useTranslations } from 'next-intl'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ArchiveImportDialog } from '@/components/editor/archive-import-dialog'
import { NotionLinkDialog } from '@/components/editor/notion-link-dialog'
import { importMarkdownBlocks } from '@/lib/markdown/import-action'
import {
  MARKDOWN_EXTENSIONS,
  MAX_MARKDOWN_BYTES,
  MAX_MARKDOWN_LABEL,
} from '@/lib/markdown/limits'
import { MAX_ZIP_BYTES, MAX_ZIP_LABEL, ZIP_EXTENSIONS } from '@/lib/notion/limits'

export type DocumentImportHandle = Readonly<{
  pickMarkdown: () => void
  pickArchive: () => void
  pickLink: () => void
}>

type Props = Readonly<{
  documentId: string
  canImportArchive: boolean
  onBlocks: (blocks: string) => void
}>

export const DocumentImport = forwardRef<DocumentImportHandle, Props>(
  function DocumentImport({ documentId, canImportArchive, onBlocks }, ref) {
    const t = useTranslations('importFile')
    const markdownRef = useRef<HTMLInputElement>(null)
    const archiveRef = useRef<HTMLInputElement>(null)
    const [reading, setReading] = useState(false)
    const [archive, setArchive] = useState<File | null>(null)
    const [linkOpen, setLinkOpen] = useState(false)

    useImperativeHandle(ref, () => ({
      pickMarkdown: () => markdownRef.current?.click(),
      pickArchive: () => {
        if (canImportArchive) {
          archiveRef.current?.click()
        }
      },
      pickLink: () => {
        if (canImportArchive) {
          setLinkOpen(true)
        }
      },
    }))

    async function handleMarkdown(file: File | undefined) {
      if (!file) {
        return
      }

      if (file.size > MAX_MARKDOWN_BYTES) {
        toast.error(t('tooLarge', { limit: MAX_MARKDOWN_LABEL }))

        return
      }

      setReading(true)

      try {
        const result = await importMarkdownBlocks(documentId, await file.text())

        if (!result.ok) {
          toast.error(result.error)

          return
        }

        onBlocks(result.blocks)
        toast.success(t('markdownInserted'))
      } catch {
        toast.error(t('failed'))
      } finally {
        setReading(false)
      }
    }

    function handleArchive(file: File | undefined) {
      if (!file) {
        return
      }

      if (file.size > MAX_ZIP_BYTES) {
        toast.error(t('tooLarge', { limit: MAX_ZIP_LABEL }))

        return
      }

      setArchive(file)
    }

    return (
      <>
        <input
          accept={MARKDOWN_EXTENSIONS.join(',')}
          aria-hidden="true"
          className="sr-only"
          data-testid="import-markdown-input"
          onChange={(event) => {
            void handleMarkdown(event.target.files?.[0])
            event.target.value = ''
          }}
          ref={markdownRef}
          tabIndex={-1}
          type="file"
        />

        {canImportArchive ? (
          <input
            accept={ZIP_EXTENSIONS.join(',')}
            aria-hidden="true"
            className="sr-only"
            data-testid="import-archive-input"
            onChange={(event) => {
              handleArchive(event.target.files?.[0])
              event.target.value = ''
            }}
            ref={archiveRef}
            tabIndex={-1}
            type="file"
          />
        ) : null}

        <span aria-live="polite" className="sr-only" role="status">
          {reading ? t('reading') : ''}
        </span>

        <ArchiveImportDialog
          file={archive}
          onOpenChange={(open) => {
            if (!open) {
              setArchive(null)
            }
          }}
          parentId={documentId}
        />

        {canImportArchive ? (
          <NotionLinkDialog
            onOpenChange={setLinkOpen}
            open={linkOpen}
            parentId={documentId}
          />
        ) : null}
      </>
    )
  },
)

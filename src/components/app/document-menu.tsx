'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentHistoryDialog } from '@/components/app/document-history-dialog'
import { MoveDocumentDialog } from '@/components/app/move-document-dialog'
import {
  EllipsisIcon,
  FileCodeIcon,
  FileDownloadIcon,
  HierarchyIcon,
  HistoryIcon,
  PagesIcon,
  TrashIcon,
} from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  duplicateDocument,
  moveToTrash,
  restoreDocument,
} from '@/lib/document-actions'

type ExportFormat = 'md' | 'html'

type Props = Readonly<{
  documentId: string
  isOwner: boolean
  canEdit: boolean
}>

function fileNameFromResponse(
  response: Response,
  format: ExportFormat,
  fallback: string,
) {
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)

  return match ? match[1] : `${fallback}.${format}`
}

export function DocumentMenu({ documentId, isOwner, canEdit }: Props) {
  const t = useTranslations('document')
  const tCommon = useTranslations('common')
  const tVersions = useTranslations('versions')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function restoreTriggerFocus(nextOpen: boolean) {
    if (!nextOpen) {
      triggerRef.current?.focus()
    }
  }
  const [exporting, setExporting] = useState(false)
  const [pending, startTransition] = useTransition()

  async function downloadExport(format: ExportFormat) {
    const response = await fetch(
      `/api/documents/${documentId}/export?format=${format}`,
    )

    if (!response.ok) {
      throw new Error('export-failed')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')

    link.href = url
    link.download = fileNameFromResponse(response, format, t('exportFileName'))
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function handleExport(format: ExportFormat) {
    setExporting(true)

    toast.promise(downloadExport(format).finally(() => setExporting(false)), {
      error: t('exportFailed'),
      loading: t('exportLoading'),
      success: t('exportSuccess'),
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateDocument(documentId)

      if (result.ok) {
        toast.success(t('duplicated'))
        router.push(`/doc/${result.id}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleTrash() {
    startTransition(async () => {
      const result = await moveToTrash(documentId)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      router.push('/')
      toast.success(t('trashed'), {
        duration: 10_000,
        action: {
          label: tCommon('undo'),
          onClick: () => {
            startTransition(async () => {
              const undone = await restoreDocument(documentId)

              if (undone.ok) {
                toast.success(t('restored'))
                router.push(`/doc/${documentId}`)
              } else {
                toast.error(undone.error)
              }
            })
          },
        },
      })
    })
  }

  return (
    <>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger asChild>
          <ButtonIcon
            aria-label={t('menuLabel')}
            ref={triggerRef}
            size="xlarge"
            variant="secondary"
          >
            <EllipsisIcon aria-hidden="true" />
          </ButtonIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {isOwner ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setOpen(false)
                setMoving(true)
              }}
            >
              <HierarchyIcon aria-hidden="true" />
              {t('moveToPage')}
            </DropdownMenuItem>
          ) : null}
          {isOwner ? (
            <DropdownMenuItem disabled={pending} onSelect={handleDuplicate}>
              <PagesIcon aria-hidden="true" />
              {t('duplicate')}
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                setOpen(false)
                setHistoryOpen(true)
              }}
            >
              <HistoryIcon aria-hidden="true" />
              {tVersions('menuItem')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={exporting}
            onSelect={() => handleExport('md')}
          >
            <FileDownloadIcon aria-hidden="true" />
            {t('exportMarkdown')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={exporting}
            onSelect={() => handleExport('html')}
          >
            <FileCodeIcon aria-hidden="true" />
            {t('exportHtml')}
          </DropdownMenuItem>
          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onSelect={handleTrash}
                variant="destructive"
              >
                <TrashIcon aria-hidden="true" />
                {t('moveToTrash')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveDocumentDialog
        documentId={documentId}
        onOpenChange={(next) => {
          setMoving(next)
          restoreTriggerFocus(next)
        }}
        open={moving}
      />

      {canEdit ? (
        <DocumentHistoryDialog
          documentId={documentId}
          onOpenChange={(next) => {
            setHistoryOpen(next)
            restoreTriggerFocus(next)
          }}
          open={historyOpen}
        />
      ) : null}
    </>
  )
}

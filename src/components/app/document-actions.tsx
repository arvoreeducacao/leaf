'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DocumentHistoryDialog } from '@/components/app/document-history-dialog'
import { MoveDocumentDialog } from '@/components/app/move-document-dialog'
import { MoveToTeamspaceDialog } from '@/components/app/move-to-teamspace-dialog'
import { RenameDocumentDialog } from '@/components/app/rename-document-dialog'
import {
  ArrowUpRightIcon,
  ClipboardContentIcon,
  FileCodeIcon,
  FileDownloadIcon,
  HierarchyIcon,
  HistoryIcon,
  PagesIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
} from '@/components/icons'
import type { MenuEntry } from '@/components/ui/menu-entries'
import {
  duplicateDocument,
  moveToTrash,
  restoreDocument,
} from '@/lib/document-actions'

type ExportFormat = 'md' | 'html'

type Options = Readonly<{
  documentId: string
  title: string
  isOwner: boolean
  canEdit: boolean
  canMoveToTeamspace: boolean
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

export function useDocumentActions({
  documentId,
  title,
  isOwner,
  canEdit,
  canMoveToTeamspace,
}: Options) {
  const t = useTranslations('document')
  const tCommon = useTranslations('common')
  const tVersions = useTranslations('versions')
  const tTeamspace = useTranslations('teamspace')
  const router = useRouter()
  const pathname = usePathname()
  const [renaming, setRenaming] = useState(false)
  const [moving, setMoving] = useState(false)
  const [movingToTeamspace, setMovingToTeamspace] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dialogsMounted, setDialogsMounted] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pending, startTransition] = useTransition()

  const documentPath = `/doc/${documentId}`

  function openDialog(setOpen: (open: boolean) => void) {
    setDialogsMounted(true)
    setOpen(true)
  }

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

  function handleCopyLink() {
    void navigator.clipboard
      .writeText(new URL(documentPath, window.location.origin).toString())
      .then(() => toast.success(t('linkCopied')))
      .catch(() => toast.error(t('linkCopyFailed')))
  }

  function handleOpenInNewTab() {
    window.open(documentPath, '_blank', 'noopener,noreferrer')
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

      if (pathname === documentPath) {
        router.push('/')
      } else {
        router.refresh()
      }

      toast.success(t('trashed'), {
        duration: 10_000,
        action: {
          label: tCommon('undo'),
          onClick: () => {
            startTransition(async () => {
              const undone = await restoreDocument(documentId)

              if (undone.ok) {
                toast.success(t('restored'))
                router.push(documentPath)
              } else {
                toast.error(undone.error)
              }
            })
          },
        },
      })
    })
  }

  const entries: Array<MenuEntry> = []

  if (canEdit) {
    entries.push({
      key: 'rename',
      label: t('rename'),
      icon: PencilIcon,
      onSelect: () => openDialog(setRenaming),
    })
  }

  entries.push({
    key: 'copy-link',
    label: t('copyLink'),
    icon: ClipboardContentIcon,
    onSelect: handleCopyLink,
  })

  if (isOwner) {
    entries.push({
      key: 'duplicate',
      label: t('duplicate'),
      icon: PagesIcon,
      onSelect: handleDuplicate,
      disabled: pending,
    })
    entries.push({
      key: 'move-to-page',
      label: t('moveToPage'),
      icon: HierarchyIcon,
      onSelect: () => openDialog(setMoving),
    })
  }

  if (canMoveToTeamspace) {
    entries.push({
      key: 'move-to-teamspace',
      label: tTeamspace('moveMenuItem'),
      icon: UsersIcon,
      onSelect: () => openDialog(setMovingToTeamspace),
    })
  }

  if (canEdit) {
    entries.push({
      key: 'history',
      label: tVersions('menuItem'),
      icon: HistoryIcon,
      onSelect: () => openDialog(setHistoryOpen),
    })
  }

  entries.push({ key: 'separator-open', separator: true })

  entries.push({
    key: 'open-new-tab',
    label: t('openInNewTab'),
    icon: ArrowUpRightIcon,
    onSelect: handleOpenInNewTab,
  })

  entries.push({
    key: 'export-md',
    label: t('exportMarkdown'),
    icon: FileDownloadIcon,
    onSelect: () => handleExport('md'),
    disabled: exporting,
  })

  entries.push({
    key: 'export-html',
    label: t('exportHtml'),
    icon: FileCodeIcon,
    onSelect: () => handleExport('html'),
    disabled: exporting,
  })

  if (isOwner) {
    entries.push({ key: 'separator-trash', separator: true })
    entries.push({
      key: 'trash',
      label: t('moveToTrash'),
      icon: TrashIcon,
      onSelect: handleTrash,
      disabled: pending,
      variant: 'destructive',
    })
  }

  const dialogs = dialogsMounted ? (
    <>
      {canEdit ? (
        <RenameDocumentDialog
          documentId={documentId}
          onOpenChange={setRenaming}
          open={renaming}
          title={title}
        />
      ) : null}

      {isOwner ? (
        <MoveDocumentDialog
          documentId={documentId}
          onOpenChange={setMoving}
          open={moving}
        />
      ) : null}

      {canMoveToTeamspace ? (
        <MoveToTeamspaceDialog
          documentId={documentId}
          onOpenChange={setMovingToTeamspace}
          open={movingToTeamspace}
        />
      ) : null}

      {canEdit ? (
        <DocumentHistoryDialog
          documentId={documentId}
          onOpenChange={setHistoryOpen}
          open={historyOpen}
        />
      ) : null}
    </>
  ) : null

  return { entries, dialogs }
}

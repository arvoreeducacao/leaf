'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { MoveDocumentDialog } from '@/components/app/move-document-dialog'
import {
  EllipsisIcon,
  FileCodeIcon,
  FileDownloadIcon,
  HierarchyIcon,
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
import { moveToTrash } from '@/lib/document-actions'

type ExportFormat = 'md' | 'html'

type Props = Readonly<{
  documentId: string
  isOwner: boolean
}>

function fileNameFromResponse(response: Response, format: ExportFormat) {
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)

  return match ? match[1] : `documento.${format}`
}

export function DocumentMenu({ documentId, isOwner }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
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
    link.download = fileNameFromResponse(response, format)
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function handleExport(format: ExportFormat) {
    setExporting(true)

    toast.promise(downloadExport(format).finally(() => setExporting(false)), {
      error: 'Não foi possível exportar o documento',
      loading: 'Preparando o arquivo',
      success: 'Download iniciado',
    })
  }

  function handleTrash() {
    startTransition(async () => {
      const result = await moveToTrash(documentId)

      if (result.ok) {
        router.push('/')
        toast.success('Documento movido para a lixeira')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger asChild>
          <ButtonIcon
            aria-label="Ações do documento"
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
              Mover para outra página
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={exporting}
            onSelect={() => handleExport('md')}
          >
            <FileDownloadIcon aria-hidden="true" />
            Exportar como Markdown
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={exporting}
            onSelect={() => handleExport('html')}
          >
            <FileCodeIcon aria-hidden="true" />
            Exportar como HTML
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
                Mover para a lixeira
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveDocumentDialog
        documentId={documentId}
        onOpenChange={setMoving}
        open={moving}
      />
    </>
  )
}

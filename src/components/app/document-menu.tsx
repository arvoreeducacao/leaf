'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { DownloadIcon, EllipsisIcon, TrashIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { moveToTrash } from '@/lib/document-actions'

type Props = Readonly<{
  documentId: string
  canDelete: boolean
}>

export function DocumentMenu({ documentId, canDelete }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled>
          <DownloadIcon aria-hidden="true" />
          Exportar
        </DropdownMenuItem>
        {canDelete ? (
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
  )
}

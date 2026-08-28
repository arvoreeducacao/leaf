'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  CaretDownIcon,
  CaretRightIcon,
  DeleteIcon,
  PageIcon,
  RotateIcon,
  TrashIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { deleteForever, restoreDocument } from '@/lib/document-actions'
import type { DocumentSummary } from '@/lib/documents'

type Props = Readonly<{
  documents: Array<DocumentSummary>
}>

export function TrashSection({ documents }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [target, setTarget] = useState<DocumentSummary | null>(null)
  const [pending, startTransition] = useTransition()

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreDocument(id)

      if (result.ok) {
        toast.success('Documento restaurado')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!target) {
      return
    }

    const id = target.id

    startTransition(async () => {
      const result = await deleteForever(id)

      if (result.ok) {
        toast.success('Documento excluído')
        setTarget(null)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="flex flex-col gap-1">
      <h2>
        <button
          aria-expanded={expanded}
          className="flex min-h-11 w-full items-center gap-2 rounded-large px-3 py-2 text-left font-bold text-caption text-gray-700 uppercase tracking-wide transition-colors hover:bg-gray-200 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? (
            <CaretDownIcon aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <CaretRightIcon aria-hidden="true" className="size-4 shrink-0" />
          )}
          <TrashIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="flex-1">Lixeira</span>
          <span className="font-normal normal-case">{documents.length}</span>
        </button>
      </h2>

      {expanded ? (
        documents.length === 0 ? (
          <p className="px-3 py-2 text-body-small text-gray-700">
            A lixeira está vazia
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {documents.map((document) => (
              <li
                className="flex min-h-11 items-center gap-3 rounded-large px-3 py-2"
                key={document.id}
              >
                <PageIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gray-600"
                />
                <span className="min-w-0 flex-1 truncate text-body-small text-gray-700">
                  {document.title}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={`Restaurar ${document.title}`}
                      disabled={pending}
                      onClick={() => handleRestore(document.id)}
                      size="medium"
                      variant="ghost"
                    >
                      <RotateIcon aria-hidden="true" />
                    </ButtonIcon>
                  </TooltipTrigger>
                  <TooltipContent>Restaurar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={`Excluir ${document.title} de vez`}
                      disabled={pending}
                      onClick={() => setTarget(document)}
                      size="medium"
                      variant="ghost"
                    >
                      <DeleteIcon aria-hidden="true" />
                    </ButtonIcon>
                  </TooltipTrigger>
                  <TooltipContent>Excluir de vez</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Dialog onOpenChange={(open) => !open && setTarget(null)} open={target !== null}>
        <DialogContent className="tablet:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Excluir de vez</DialogTitle>
            <DialogDescription className="text-gray-700">
              O documento {target?.title} será apagado sem possibilidade de
              recuperação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={() => setTarget(null)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              aria-busy={pending}
              className="w-full bg-error-700 hover:bg-error-800 tablet:w-auto"
              disabled={pending}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              Excluir de vez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

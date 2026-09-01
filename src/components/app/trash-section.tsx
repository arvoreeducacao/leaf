'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  sidebarEmpty,
  sidebarIcon,
  sidebarRow,
} from '@/components/app/sidebar-styles'
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
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documents: Array<DocumentSummary>
}>

export function TrashSection({ documents }: Props) {
  const t = useTranslations('trash')
  const tCommon = useTranslations('common')
  const [expanded, setExpanded] = useState(false)
  const [target, setTarget] = useState<DocumentSummary | null>(null)
  const [pending, startTransition] = useTransition()

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreDocument(id)

      if (result.ok) {
        toast.success(t('restored'))
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
        toast.success(t('deleted'))
        setTarget(null)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <section className="flex flex-col">
      <h2>
        <button
          aria-expanded={expanded}
          className={cn(sidebarRow, 'cursor-pointer')}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <TrashIcon aria-hidden="true" className={sidebarIcon} />
          </span>
          <span className="min-w-0 flex-1 truncate">{t('title')}</span>
          {documents.length > 0 ? (
            <span className="shrink-0 text-caption text-content-disabled">
              {documents.length}
            </span>
          ) : null}
          {expanded ? (
            <CaretDownIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 text-content-subtle"
            />
          ) : (
            <CaretRightIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 text-content-subtle"
            />
          )}
        </button>
      </h2>

      {expanded ? (
        documents.length === 0 ? (
          <p className={sidebarEmpty}>{t('empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {documents.map((document) => (
              <li
                className="group/trash flex h-11 items-center gap-1.5 rounded-large pr-0.5 pl-1.5 hover:bg-surface-hover tablet:h-7"
                key={document.id}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <PageIcon aria-hidden="true" className={sidebarIcon} />
                </span>
                <span className="min-w-0 flex-1 truncate text-body-small text-content">
                  {document.title}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={t('restoreItem', { title: document.title })}
                      className="tablet:opacity-0 tablet:group-focus-within/trash:opacity-100 tablet:group-hover/trash:opacity-100"
                      disabled={pending}
                      onClick={() => handleRestore(document.id)}
                      size="small"
                      variant="ghost"
                    >
                      <RotateIcon aria-hidden="true" />
                    </ButtonIcon>
                  </TooltipTrigger>
                  <TooltipContent>{t('restore')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonIcon
                      aria-label={t('deleteItem', { title: document.title })}
                      className="tablet:opacity-0 tablet:group-focus-within/trash:opacity-100 tablet:group-hover/trash:opacity-100"
                      disabled={pending}
                      onClick={() => setTarget(document)}
                      size="small"
                      variant="ghost"
                    >
                      <DeleteIcon aria-hidden="true" />
                    </ButtonIcon>
                  </TooltipTrigger>
                  <TooltipContent>{t('deleteForever')}</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Dialog onOpenChange={(open) => !open && setTarget(null)} open={target !== null}>
        <DialogContent
          className="tablet:max-w-110"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('deleteForever')}</DialogTitle>
            <DialogDescription className="text-content">
              {t('confirmDescription', { title: target?.title ?? '' })}
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
              {tCommon('cancel')}
            </Button>
            <Button
              aria-busy={pending}
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              {t('deleteForever')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

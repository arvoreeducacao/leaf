'use client'

import * as PeekPrimitive from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { CancelIcon } from '@/components/icons'
import { ExpandDiagonalIcon } from '@/components/icons/topbar'
import { announceRowChange } from '@/lib/database/row-sync'
import { renameDocument } from '@/lib/document-actions'

type Props = Readonly<{
  rowId: string
  title: string
  icon: string | null
  canEdit: boolean
  children: ReactNode
}>

export function RowPeekSheet({ rowId, title, icon, canEdit, children }: Props) {
  const router = useRouter()
  const t = useTranslations('database')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState(title)

  function close() {
    setOpen(false)
    router.back()
  }

  function rename() {
    const trimmed = draft.trim()

    if (trimmed === title.trim()) {
      return
    }

    announceRowChange({ rowId, title: trimmed })
    void renameDocument(rowId, trimmed)
  }

  return (
    <PeekPrimitive.Root
      modal={false}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
      open={open}
    >
      <PeekPrimitive.Portal>
        <PeekPrimitive.Content
          aria-describedby={undefined}
          className="fade-in-0 slide-in-from-right-8 fixed inset-y-0 right-0 z-40 flex w-full animate-in flex-col border-line-soft border-l bg-surface-app shadow-down-xlarge outline-none duration-200 tablet:w-[min(760px,60vw)]"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault()

            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.focus()
            }
          }}
        >
          <PeekPrimitive.Title className="sr-only">
            {draft.trim() || t('untitledRow')}
          </PeekPrimitive.Title>
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-line-divider border-b px-2">
            <Link
              className="flex h-8 items-center gap-1.5 rounded-large px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
              href={`/doc/${rowId}`}
            >
              <ExpandDiagonalIcon aria-hidden="true" className="size-4" />
              {t('openRow')}
            </Link>
            <PeekPrimitive.Close
              aria-label={tCommon('close')}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-large text-content-subtle transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
            >
              <CancelIcon aria-hidden="true" className="size-4" />
            </PeekPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 px-4 pt-8 tablet:px-[54px]">
              <DocumentIcon className="size-10 text-[36px]" icon={icon} />
              {canEdit ? (
                <input
                  aria-label={t('rowTitleLabel')}
                  className="w-full bg-transparent font-bold text-display-small text-content-strong outline-none placeholder:text-content-disabled"
                  onBlur={rename}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                  placeholder={t('untitledRow')}
                  value={draft}
                />
              ) : (
                <h2 className="font-bold text-display-small text-content-strong">
                  {draft.trim() || t('untitledRow')}
                </h2>
              )}
            </div>
            {children}
          </div>
        </PeekPrimitive.Content>
      </PeekPrimitive.Portal>
    </PeekPrimitive.Root>
  )
}

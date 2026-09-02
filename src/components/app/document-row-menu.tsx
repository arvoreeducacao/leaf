'use client'

import { useTranslations } from 'next-intl'

import { useDocumentActions } from '@/components/app/document-actions'
import { EllipsisIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContextEntries, DropdownEntries } from '@/components/ui/menu-entries'

type Props = Readonly<{
  documentId: string
  title: string
  owned: boolean
  hasOrganization: boolean
  className?: string
  children: React.ReactNode
}>

export function DocumentRowMenu({
  documentId,
  title,
  owned,
  hasOrganization,
  className,
  children,
}: Props) {
  const t = useTranslations('document')
  const { entries, dialogs } = useDocumentActions({
    canEdit: owned,
    canMoveToTeamspace: owned && hasOrganization,
    documentId,
    isOwner: owned,
    title,
  })

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={className}>
            {children}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ButtonIcon
                  aria-label={t('rowMenuLabel', { title })}
                  className="shrink-0 tablet:opacity-0 tablet:group-focus-within/row:opacity-100 tablet:group-hover/row:opacity-100 tablet:data-[state=open]:opacity-100"
                  size="small"
                  variant="ghost"
                >
                  <EllipsisIcon aria-hidden="true" />
                </ButtonIcon>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" side="right">
                <DropdownEntries entries={entries} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>

      {dialogs}
    </>
  )
}

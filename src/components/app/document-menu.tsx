'use client'

import { useTranslations } from 'next-intl'

import { useDocumentActions } from '@/components/app/document-actions'
import { EllipsisIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownEntries } from '@/components/ui/menu-entries'

type Props = Readonly<{
  documentId: string
  title: string
  isOwner: boolean
  canEdit: boolean
  canMoveToTeamspace: boolean
}>

export function DocumentMenu({
  documentId,
  title,
  isOwner,
  canEdit,
  canMoveToTeamspace,
}: Props) {
  const t = useTranslations('document')
  const { entries, dialogs } = useDocumentActions({
    canEdit,
    canMoveToTeamspace,
    documentId,
    isOwner,
    title,
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ButtonIcon aria-label={t('menuLabel')} size="medium" variant="ghost">
            <EllipsisIcon aria-hidden="true" />
          </ButtonIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownEntries entries={entries} />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  )
}

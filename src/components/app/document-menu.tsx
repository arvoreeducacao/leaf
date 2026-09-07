'use client'

import { useTranslations } from 'next-intl'

import { useDocumentActions } from '@/components/app/document-actions'
import { useEditorStatus } from '@/components/editor/status-bridge'
import { EllipsisIcon } from '@/components/icons/outline'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
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
  const tEditor = useTranslations('editor')
  const { stats } = useEditorStatus()
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
          <ButtonIcon
            aria-label={t('menuLabel')}
            className="[&_svg]:size-5"
            size="medium"
            variant="ghost"
          >
            <EllipsisIcon aria-hidden="true" />
          </ButtonIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownEntries entries={entries} />
          {stats ? (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1 text-caption text-content-subtle">
                {tEditor('words', { count: stats.words })}
                {' · '}
                {tEditor('characters', { count: stats.characters })}
              </p>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  )
}

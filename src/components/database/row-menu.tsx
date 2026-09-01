'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import {
  ArrowExpandIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from '@/components/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type RowMoveTarget = Readonly<{ id: string | null; name: string }>

type Props = Readonly<{
  rowId: string
  title: string
  canEdit: boolean
  moveTargets?: ReadonlyArray<RowMoveTarget>
  onMove?: (groupId: string | null) => void
  onDelete: () => void
}>

export function RowMenu({
  rowId,
  title,
  canEdit,
  moveTargets,
  onMove,
  onDelete,
}: Props) {
  const t = useTranslations('database')
  const tCommon = useTranslations('common')
  const [confirming, setConfirming] = useState(false)
  const label = title.trim().length > 0 ? title : t('untitledRow')

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ButtonIcon
            aria-label={t('rowMenu', { title: label })}
            size="medium"
            variant="ghost"
          >
            <EllipsisVerticalIcon aria-hidden="true" />
          </ButtonIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/doc/${rowId}`}>
              <ArrowExpandIcon aria-hidden="true" />
              {t('openRow')}
            </Link>
          </DropdownMenuItem>
          {canEdit && onMove && moveTargets && moveTargets.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t('moveTo')}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {moveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id ?? 'none'}
                    onSelect={() => onMove(target.id)}
                  >
                    {target.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              variant="destructive"
            >
              <TrashIcon aria-hidden="true" />
              {t('deleteRow')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteRowTitle', { title: label })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('deleteRowBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>
              {t('deleteRow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

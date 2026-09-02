'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  ArrowExpandIcon,
  ArrowUpRightIcon,
  ClipboardContentIcon,
  EllipsisVerticalIcon,
  HierarchyIcon,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextEntries,
  DropdownEntries,
  type MenuEntry,
} from '@/components/ui/menu-entries'

export type RowMoveTarget = Readonly<{ id: string | null; name: string }>

type Props = Readonly<{
  rowId: string
  title: string
  canEdit: boolean
  moveTargets?: ReadonlyArray<RowMoveTarget>
  onMove?: (groupId: string | null) => void
  onDelete: () => void
}>

function useRowActions({
  rowId,
  title,
  canEdit,
  moveTargets,
  onMove,
  onDelete,
}: Props) {
  const t = useTranslations('database')
  const tCommon = useTranslations('common')
  const tDocument = useTranslations('document')
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const label = title.trim().length > 0 ? title : t('untitledRow')
  const rowPath = `/doc/${rowId}`

  const entries: Array<MenuEntry> = [
    {
      icon: ArrowExpandIcon,
      key: 'open',
      label: t('openRow'),
      onSelect: () => router.push(rowPath),
    },
    {
      icon: ArrowUpRightIcon,
      key: 'open-new-tab',
      label: tDocument('openInNewTab'),
      onSelect: () => window.open(rowPath, '_blank', 'noopener,noreferrer'),
    },
    {
      icon: ClipboardContentIcon,
      key: 'copy-link',
      label: tDocument('copyLink'),
      onSelect: () => {
        void navigator.clipboard
          .writeText(new URL(rowPath, window.location.origin).toString())
          .then(() => toast.success(tDocument('linkCopied')))
          .catch(() => toast.error(tDocument('linkCopyFailed')))
      },
    },
  ]

  if (canEdit && onMove && moveTargets && moveTargets.length > 0) {
    entries.push({
      icon: HierarchyIcon,
      items: moveTargets.map((target) => ({
        key: target.id ?? 'none',
        label: target.name,
        onSelect: () => onMove(target.id),
      })),
      key: 'move',
      label: t('moveTo'),
    })
  }

  if (canEdit) {
    entries.push({ key: 'separator-delete', separator: true })
    entries.push({
      icon: TrashIcon,
      key: 'delete',
      label: t('deleteRow'),
      onSelect: () => setConfirming(true),
      variant: 'destructive',
    })
  }

  const dialogs = (
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
  )

  return { entries, dialogs, label }
}

export function RowMenu(props: Props) {
  const t = useTranslations('database')
  const { entries, dialogs, label } = useRowActions(props)

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
          <DropdownEntries entries={entries} />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  )
}

export function RowContextMenu({
  children,
  ...props
}: Props & Readonly<{ children: React.ReactNode }>) {
  const { entries, dialogs } = useRowActions(props)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          <ContextEntries entries={entries} />
        </ContextMenuContent>
      </ContextMenu>

      {dialogs}
    </>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { EllipsisVerticalIcon, EyeOffIcon, TrashIcon } from '@/components/icons'
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'
import { propertyTypes } from '@/lib/database/values'

import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  property: DatabaseProperty
  canEdit: boolean
  onRename: (name: string) => void
  onChangeType: (type: DatabasePropertyType) => void
  onHide: () => void
  onDelete: () => void
}>

export function PropertyHeader({
  property,
  canEdit,
  onRename,
  onChangeType,
  onHide,
  onDelete,
}: Props) {
  const t = useTranslations('database')
  const tCommon = useTranslations('common')
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (renaming) {
    return (
      <input
        aria-label={t('propertyNameLabel')}
        autoFocus
        className="h-8 w-full min-w-0 rounded-medium border border-line-contrast bg-surface-card px-2 text-body-small text-content-strong outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
        defaultValue={property.name}
        onBlur={(event) => {
          onRename(event.target.value)
          setRenaming(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }

          if (event.key === 'Escape') {
            setRenaming(false)
          }
        }}
      />
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <PropertyIcon
        className="size-4 shrink-0 text-content-subtle"
        type={property.type}
      />
      <span className="min-w-0 flex-1 truncate">{property.name}</span>
      {canEdit ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ButtonIcon
                aria-label={t('propertyMenu', { name: property.name })}
                size="small"
                variant="ghost"
              >
                <EllipsisVerticalIcon aria-hidden="true" />
              </ButtonIcon>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                {t('renameProperty')}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t('changeType')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>{t('propertyTypeLabel')}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) =>
                      onChangeType(value as DatabasePropertyType)
                    }
                    value={property.type}
                  >
                    {propertyTypes.map((type) => (
                      <DropdownMenuRadioItem key={type} value={type}>
                        <PropertyIcon type={type} />
                        {t(`type_${type}`)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={onHide}>
                <EyeOffIcon aria-hidden="true" />
                {t('hideProperty')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirming(true)}
                variant="destructive"
              >
                <TrashIcon aria-hidden="true" />
                {t('deleteProperty')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog onOpenChange={setConfirming} open={confirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('deletePropertyTitle', { name: property.name })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deletePropertyBody')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  {t('deleteProperty')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'

import { AddIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DatabasePropertyType } from '@/db/schema'
import { propertyTypes } from '@/lib/database/values'

import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  onAdd: (type: DatabasePropertyType) => Promise<string | null>
  hasOrganization: boolean
}>

export function AddPropertyMenu({ onAdd, hasOrganization }: Props) {
  const t = useTranslations('database')
  const offered = hasOrganization
    ? propertyTypes
    : propertyTypes.filter((type) => type !== 'person')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ButtonIcon aria-label={t('addProperty')} size="medium" variant="ghost">
          <AddIcon aria-hidden="true" />
        </ButtonIcon>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('addProperty')}</DropdownMenuLabel>
        {offered.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => void onAdd(type)}>
            <PropertyIcon type={type} />
            {t(`type_${type}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

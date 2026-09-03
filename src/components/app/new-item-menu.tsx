'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { ComposeIcon, PageIcon, TableIcon } from '@/components/icons/outline'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownEntries, type MenuEntry } from '@/components/ui/menu-entries'
import { createDatabasePage } from '@/lib/database-actions'
import { createDocument } from '@/lib/document-actions'

export function NewItemMenu() {
  const t = useTranslations('nav')
  const [pending, startTransition] = useTransition()

  function run(create: () => Promise<unknown>, failureMessage: string) {
    startTransition(async () => {
      try {
        await create()
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          throw error
        }

        toast.error(failureMessage)
      }
    })
  }

  const entries: ReadonlyArray<MenuEntry> = [
    {
      icon: PageIcon,
      key: 'document',
      label: t('newItemDocument'),
      onSelect: () => run(createDocument, t('newDocumentFailed')),
    },
    {
      icon: TableIcon,
      key: 'database',
      label: t('newItemDatabase'),
      onSelect: () => run(createDatabasePage, t('newDatabaseFailed')),
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ButtonIcon
          aria-busy={pending}
          aria-label={t('newItem')}
          disabled={pending}
          size="medium"
          variant="ghost"
        >
          <ComposeIcon aria-hidden="true" />
        </ButtonIcon>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { TableIcon } from '@/components/icons/outline'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { createDatabasePage } from '@/lib/database-actions'
import { cn } from '@/shared/utils'

type Props = Readonly<{ variant?: 'sidebar' | 'primary' | 'icon' }>

export function NewDatabaseButton({ variant = 'sidebar' }: Props) {
  const t = useTranslations('nav')
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      try {
        await createDatabasePage()
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          throw error
        }

        toast.error(t('newDatabaseFailed'))
      }
    })
  }

  if (variant === 'icon') {
    return (
      <ButtonIcon
        aria-busy={pending}
        aria-label={t('newDatabase')}
        disabled={pending}
        onClick={handleClick}
        size="medium"
        variant="ghost"
      >
        <TableIcon aria-hidden="true" />
      </ButtonIcon>
    )
  }

  if (variant === 'primary') {
    return (
      <Button
        aria-busy={pending}
        disabled={pending}
        onClick={handleClick}
        type="button"
        variant="outline"
      >
        <TableIcon aria-hidden="true" />
        {t('newDatabase')}
      </Button>
    )
  }

  return (
    <button
      aria-busy={pending}
      className={cn(sidebarRow, 'cursor-pointer disabled:opacity-60')}
      disabled={pending}
      onClick={handleClick}
      type="button"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <TableIcon aria-hidden="true" className={sidebarIcon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{t('newDatabase')}</span>
    </button>
  )
}

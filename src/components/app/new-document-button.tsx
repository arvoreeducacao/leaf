'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { PlusIcon } from '@/components/icons/outline'
import { Button } from '@/components/ui/button'
import { createDocument } from '@/lib/document-actions'
import { cn } from '@/shared/utils'

type Props = Readonly<{ variant?: 'sidebar' | 'primary' }>

export function NewDocumentButton({ variant = 'sidebar' }: Props) {
  const t = useTranslations('nav')
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      try {
        await createDocument()
      } catch (error) {
        if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
          throw error
        }

        toast.error(t('newDocumentFailed'))
      }
    })
  }

  if (variant === 'primary') {
    return (
      <Button
        aria-busy={pending}
        disabled={pending}
        onClick={handleClick}
        type="button"
      >
        <PlusIcon aria-hidden="true" />
        {t('newDocument')}
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
        <PlusIcon aria-hidden="true" className={sidebarIcon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{t('newDocument')}</span>
    </button>
  )
}

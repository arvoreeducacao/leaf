'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { AddIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { createDocument } from '@/lib/document-actions'

export function NewDocumentButton() {
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

  return (
    <Button
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={handleClick}
      type="button"
    >
      <AddIcon aria-hidden="true" />
      {t('newDocument')}
    </Button>
  )
}

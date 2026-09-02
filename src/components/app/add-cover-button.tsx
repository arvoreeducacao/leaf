'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { ImageIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { setDocumentCover } from '@/lib/document-actions'
import { randomGradientCover } from '@/lib/document-cover'

type Props = Readonly<{ documentId: string }>

export function AddCoverButton({ documentId }: Props) {
  const t = useTranslations('cover')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function add() {
    startTransition(async () => {
      const result = await setDocumentCover(documentId, {
        cover: randomGradientCover(),
      })

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      router.refresh()
    })
  }

  return (
    <Button
      className="text-content-subtle"
      disabled={pending}
      onClick={add}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ImageIcon aria-hidden="true" />
      {pending ? t('adding') : t('add')}
    </Button>
  )
}

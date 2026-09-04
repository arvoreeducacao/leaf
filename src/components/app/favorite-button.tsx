'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { useFavorites } from '@/components/app/favorites-provider'
import { FavoriteFilledIcon, FavoriteIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toggleFavorite } from '@/lib/document-actions'

export function FavoriteButton({
  documentId,
}: Readonly<{ documentId: string }>) {
  const t = useTranslations('document')
  const router = useRouter()
  const favorites = useFavorites()
  const favorited = favorites.isFavorite(documentId)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const next = !favorited

    favorites.setFavorite(documentId, next)

    startTransition(async () => {
      const result = await toggleFavorite(documentId)

      if (!result.ok) {
        favorites.setFavorite(documentId, !next)
        toast.error(result.error)

        return
      }

      router.refresh()
    })
  }

  const label = favorited ? t('unfavorite') : t('favorite')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ButtonIcon
          aria-label={label}
          aria-pressed={favorited}
          disabled={pending}
          onClick={handleClick}
          size="medium"
          variant="ghost"
        >
          {favorited ? (
            <FavoriteFilledIcon aria-hidden="true" className="text-warn" />
          ) : (
            <FavoriteIcon aria-hidden="true" />
          )}
        </ButtonIcon>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

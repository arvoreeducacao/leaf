'use client'

import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  const t = useTranslations('common')

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 pt-10 tablet:px-[54px] tablet:pt-20">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <Skeleton className="h-11 w-full max-w-90" />
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full max-w-130" />
        <Skeleton className="h-4 w-full max-w-110" />
      </div>
    </div>
  )
}

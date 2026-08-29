'use client'

import { useTranslations } from 'next-intl'

import { AlertIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

type Props = Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>

export default function AppError({ reset }: Props) {
  const t = useTranslations('errors')
  const tCommon = useTranslations('common')

  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center gap-4 px-4 py-10 text-center tablet:px-8">
      <AlertIcon aria-hidden="true" className="size-10 text-danger" />
      <h1 className="font-bold text-heading-large text-content-strong">
        {t('appTitle')}
      </h1>
      <p className="max-w-110 text-body-medium text-content">
        {t('appBody')}
      </p>
      <Button onClick={reset} type="button">
        {tCommon('tryAgain')}
      </Button>
    </div>
  )
}

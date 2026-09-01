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
    <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-4 pt-20 tablet:px-[54px]">
      <AlertIcon aria-hidden="true" className="size-7 text-danger" />
      <h1 className="font-semibold text-content-strong text-heading-large">
        {t('appTitle')}
      </h1>
      <p className="max-w-prose-leaf text-body-medium text-content">
        {t('appBody')}
      </p>
      <Button className="mt-3 self-start" onClick={reset} type="button">
        {tCommon('tryAgain')}
      </Button>
    </div>
  )
}

import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { PageCancelIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default async function AppNotFound() {
  const t = await getTranslations('errors')
  const tCommon = await getTranslations('common')

  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center gap-4 px-4 py-10 text-center tablet:px-8">
      <PageCancelIcon aria-hidden="true" className="size-10 text-content-muted" />
      <h1 className="font-bold text-heading-large text-content-strong">
        {t('documentNotFoundTitle')}
      </h1>
      <p className="max-w-110 text-body-medium text-content">
        {t('documentNotFoundBody')}
      </p>
      <Button asChild>
        <Link href="/">{tCommon('backHome')}</Link>
      </Button>
    </div>
  )
}

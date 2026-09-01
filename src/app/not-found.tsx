import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { LeafIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const t = await getTranslations('errors')
  const tCommon = await getTranslations('common')

  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-110 flex-col items-center gap-4 text-center">
        <LeafIcon aria-hidden="true" className="size-8 text-brand" />
        <h1 className="font-semibold text-content-strong text-heading-large">
          {t('pageNotFoundTitle')}
        </h1>
        <p className="text-body-medium text-content">
          {t('pageNotFoundBody')}
        </p>
        <Button asChild>
          <Link href="/">{tCommon('backHome')}</Link>
        </Button>
      </div>
    </main>
  )
}

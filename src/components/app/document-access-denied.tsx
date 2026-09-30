import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { PadlockIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export async function DocumentAccessDenied() {
  const t = await getTranslations('errors')
  const tCommon = await getTranslations('common')

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-4 pt-20 tablet:px-[54px]">
      <PadlockIcon aria-hidden="true" className="size-7 text-content-subtle" />
      <h1 className="font-semibold text-content-strong text-heading-large">
        {t('documentForbiddenTitle')}
      </h1>
      <p className="max-w-prose-leaf text-body-medium text-content">
        {t('documentForbiddenBody')}
      </p>
      <Button asChild className="mt-3 self-start">
        <Link href="/">{tCommon('backHome')}</Link>
      </Button>
    </div>
  )
}

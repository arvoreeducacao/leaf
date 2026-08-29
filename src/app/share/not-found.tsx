import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { LeafIcon, PageCancelIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default async function ShareNotFound() {
  const t = await getTranslations('publicShare')
  const tCommon = await getTranslations('common')

  return (
    <div className="flex min-h-dvh flex-col bg-surface-app">
      <header className="flex items-center gap-2 border-line border-b px-4 py-3 tablet:px-8">
        <LeafIcon aria-hidden="true" className="size-5 text-brand" />
        <span className="font-bold text-body-medium text-content-strong">Leaf</span>
      </header>
      <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center tablet:px-8">
        <PageCancelIcon aria-hidden="true" className="size-10 text-content-muted" />
        <h1 className="font-bold text-heading-large text-content-strong">
          {t('notFoundTitle')}
        </h1>
        <p className="max-w-110 text-body-medium text-content">
          {t('notFoundBody')}
        </p>
        <Button asChild>
          <Link href="/">{tCommon('goToLeaf')}</Link>
        </Button>
      </main>
    </div>
  )
}

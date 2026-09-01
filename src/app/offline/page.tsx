import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LeafMark } from '@/components/app/leaf-mark'
import { OfflineRetry } from '@/components/app/offline-retry'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('offline')

  return { title: t('pageTitle') }
}

export default async function OfflinePage() {
  const t = await getTranslations('offline')

  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-110 flex-col items-center gap-4 text-center">
        <LeafMark aria-hidden="true" className="size-8 text-brand" />
        <h1 className="font-semibold text-content-strong text-heading-large">
          {t('pageTitle')}
        </h1>
        <p className="text-body-medium text-content">{t('pageBody')}</p>
        <OfflineRetry />
      </div>
    </main>
  )
}

import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { LeafMark } from '@/components/app/leaf-mark'
import { AlertIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export async function ConsentInvalid() {
  const t = await getTranslations('oauthConsent')
  const tCommon = await getTranslations('common')

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-surface-app px-6 py-10">
      <div className="w-full max-w-100">
        <div className="flex items-center gap-2">
          <LeafMark aria-hidden="true" className="size-6 text-brand" />
          <span className="font-semibold text-content-strong text-heading-medium">
            Leaf
          </span>
        </div>

        <div
          className="mt-10 flex items-start gap-3 rounded-large bg-danger-surface p-4 text-danger"
          role="alert"
        >
          <AlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-body-medium">{t('invalidTitle')}</h1>
            <p className="text-body-small">{t('invalidBody')}</p>
          </div>
        </div>

        <Button asChild className="mt-6" variant="secondary">
          <Link href="/">{tCommon('goToLeaf')}</Link>
        </Button>
      </div>
    </main>
  )
}

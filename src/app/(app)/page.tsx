import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { NewDocumentButton } from '@/components/app/new-document-button'
import { LeafIcon } from '@/components/icons'
import { getSession } from '@/lib/auth'
import { listOwnedDocuments } from '@/lib/documents'

export default async function HomePage() {
  const t = await getTranslations('home')
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const owned = await listOwnedDocuments(session.user.id)

  if (owned.length > 0) {
    redirect(`/doc/${owned[0].id}`)
  }

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 tablet:px-8 tablet:py-10">
      <section className="flex flex-col items-center gap-4 rounded-xlarge border border-line-subtle bg-surface-nav px-4 py-10 text-center tablet:px-8">
        <LeafIcon aria-hidden="true" className="size-10 text-brand" />
        <h1 className="font-bold text-heading-large text-content-strong">
          {t('title')}
        </h1>
        <p className="max-w-110 text-body-medium text-content">
          {t('subtitle')}
        </p>
        <div className="w-full max-w-70">
          <NewDocumentButton />
        </div>
      </section>
    </div>
  )
}

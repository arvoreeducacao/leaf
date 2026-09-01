import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { NewDatabaseButton } from '@/components/app/new-database-button'
import { NewDocumentButton } from '@/components/app/new-document-button'
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
    <div className="mx-auto flex w-full max-w-page flex-col px-4 pt-10 pb-40 tablet:px-[54px] tablet:pt-20">
      <h1 className="font-heavy text-content-disabled text-display-medium">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-prose-leaf text-body-medium text-content">
        {t('subtitle')}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <NewDocumentButton variant="primary" />
        <NewDatabaseButton variant="primary" />
      </div>
    </div>
  )
}

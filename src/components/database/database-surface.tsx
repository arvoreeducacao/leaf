import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { getSession } from '@/lib/auth'
import { loadDatabase } from '@/lib/databases'

import { DatabaseView } from './database-view'

type Props = Readonly<{
  databaseId: string
  canEdit: boolean
  compact?: boolean
}>

export async function DatabaseSurface({
  databaseId,
  canEdit,
  compact = false,
}: Props) {
  const session = await getSession()
  const snapshot = await loadDatabase(databaseId, session?.user.id ?? null)

  if (!snapshot) {
    const t = await getTranslations('database')

    return (
      <p className="px-4 py-6 text-body-small text-content tablet:px-[54px]">
        {t('blockMissing')}
      </p>
    )
  }

  return (
    <Suspense>
      <DatabaseView canEdit={canEdit} compact={compact} snapshot={snapshot} />
    </Suspense>
  )
}

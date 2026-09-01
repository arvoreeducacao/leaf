import { getTranslations } from 'next-intl/server'

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
  const snapshot = await loadDatabase(databaseId)

  if (!snapshot) {
    const t = await getTranslations('database')

    return (
      <p className="px-4 py-6 text-body-small text-content tablet:px-[54px]">
        {t('blockMissing')}
      </p>
    )
  }

  return (
    <div className={compact ? undefined : 'px-4 tablet:px-[54px]'}>
      <DatabaseView canEdit={canEdit} compact={compact} snapshot={snapshot} />
    </div>
  )
}

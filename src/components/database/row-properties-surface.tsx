import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { ArrowLeftIcon } from '@/components/icons'
import { getSession } from '@/lib/auth'
import { loadRowContext } from '@/lib/databases'

import { RowProperties } from './row-properties'

type Props = Readonly<{ rowId: string; canEdit: boolean }>

export async function RowPropertiesSurface({ rowId, canEdit }: Props) {
  const session = await getSession()
  const context = await loadRowContext(rowId, session?.user.id ?? null)

  if (!context) {
    return null
  }

  const t = await getTranslations('database')

  return (
    <div className="flex flex-col gap-3 border-line-divider border-b pb-4">
      <Link
        className="flex w-fit items-center gap-2 rounded-medium text-body-small text-content transition-colors hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        href={`/doc/${context.databaseId}`}
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t('backToDatabase', { title: context.databaseTitle })}
      </Link>
      <RowProperties
        canEdit={canEdit}
        people={context.people}
        properties={context.properties}
        row={context.row}
      />
    </div>
  )
}

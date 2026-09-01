import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { CaretRightIcon } from '@/components/icons'
import type { DocumentCrumb } from '@/lib/documents'

type Props = Readonly<{
  crumbs: Array<DocumentCrumb>
}>

export async function DocumentBreadcrumb({ crumbs }: Props) {
  const t = await getTranslations('document')

  if (crumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label={t('breadcrumbLabel')} className="min-w-0 shrink">
      <ol className="flex min-w-0 items-center gap-0.5">
        {crumbs.map((crumb, index) => (
          <li className="flex min-w-0 items-center gap-0.5" key={crumb.id}>
            {index > 0 ? (
              <CaretRightIcon
                aria-hidden="true"
                className="size-3 shrink-0 text-content-disabled"
              />
            ) : null}
            <Link
              className="inline-flex min-w-0 max-w-40 items-center rounded-large px-1.5 py-0.5 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
              href={`/doc/${crumb.id}`}
            >
              <span className="min-w-0 truncate">{crumb.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

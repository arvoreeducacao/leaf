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
    <nav aria-label={t('breadcrumbLabel')}>
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => (
          <li className="flex items-center gap-1" key={crumb.id}>
            {index > 0 ? (
              <CaretRightIcon
                aria-hidden="true"
                className="size-3 shrink-0 text-content-muted"
              />
            ) : null}
            <Link
              className="inline-flex min-h-11 max-w-48 items-center rounded-medium px-1 text-body-small text-content transition-colors hover:text-content-strong hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
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

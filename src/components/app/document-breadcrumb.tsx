import Link from 'next/link'

import { CaretRightIcon } from '@/components/icons'
import type { DocumentCrumb } from '@/lib/documents'

type Props = Readonly<{
  crumbs: Array<DocumentCrumb>
}>

export function DocumentBreadcrumb({ crumbs }: Props) {
  if (crumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label="Caminho do documento">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => (
          <li className="flex items-center gap-1" key={crumb.id}>
            {index > 0 ? (
              <CaretRightIcon
                aria-hidden="true"
                className="size-3 shrink-0 text-gray-600"
              />
            ) : null}
            <Link
              className="inline-flex min-h-11 max-w-48 items-center rounded-medium px-1 text-body-small text-gray-700 transition-colors hover:text-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
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

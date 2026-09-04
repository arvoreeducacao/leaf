'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { ChevronRightIcon, EllipsisIcon } from '@/components/icons/outline'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DocumentCrumb } from '@/lib/documents'

type Props = Readonly<{
  crumbs: Array<DocumentCrumb>
}>

const visibleCrumbs = 2

const crumbLink =
  'inline-flex min-w-0 max-w-40 items-center rounded-large px-1.5 py-0.5 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

function Separator() {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className="size-3 shrink-0 text-content-disabled"
    />
  )
}

function Crumb({ crumb }: Readonly<{ crumb: DocumentCrumb }>) {
  return (
    <Link className={crumbLink} href={`/doc/${crumb.id}`} title={crumb.title}>
      <DocumentIcon className="mr-1.5 size-4" icon={crumb.icon} kind={crumb.kind} />
      <span className="min-w-0 truncate">{crumb.title}</span>
    </Link>
  )
}

export function DocumentBreadcrumb({ crumbs }: Props) {
  const t = useTranslations('document')

  if (crumbs.length === 0) {
    return null
  }

  const collapsed =
    crumbs.length > visibleCrumbs + 1
      ? crumbs.slice(0, crumbs.length - visibleCrumbs)
      : []
  const tail = crumbs.slice(collapsed.length)

  return (
    <nav aria-label={t('breadcrumbLabel')} className="flex min-w-0 shrink">
      <ol className="flex min-w-0 items-center gap-0.5">
        {collapsed.length > 0 ? (
          <li className="flex shrink-0 items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('breadcrumbCollapsed', {
                  count: collapsed.length,
                })}
                className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-large bg-surface-hover px-1.5 text-caption text-content transition-colors hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
              >
                <EllipsisIcon aria-hidden="true" className="size-3.5" />
                {collapsed.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {collapsed.map((crumb) => (
                  <DropdownMenuItem asChild key={crumb.id}>
                    <Link href={`/doc/${crumb.id}`}>
                      <DocumentIcon
                        className="size-4"
                        icon={crumb.icon}
                        kind={crumb.kind}
                      />
                      <span className="min-w-0 truncate">{crumb.title}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator />
          </li>
        ) : null}

        {tail.map((crumb, index) => (
          <li className="flex min-w-0 items-center gap-0.5" key={crumb.id}>
            {index > 0 ? <Separator /> : null}
            <Crumb crumb={crumb} />
          </li>
        ))}
      </ol>
    </nav>
  )
}

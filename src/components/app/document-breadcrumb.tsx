'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { EllipsisIcon } from '@/components/icons/outline'
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

export const crumbClass =
  'inline-flex h-6 min-w-0 max-w-60 items-center rounded-large py-0.5 pr-[5px] pl-[3px] text-body-small text-content-strong transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1'

export function CrumbSeparator() {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 px-px text-[13px] text-content-disabled"
    >
      /
    </span>
  )
}

function Crumb({ crumb }: Readonly<{ crumb: DocumentCrumb }>) {
  return (
    <Link className={crumbClass} href={`/doc/${crumb.id}`} title={crumb.title}>
      <DocumentIcon
        className="mr-1 size-4.5 text-[16px]"
        icon={crumb.icon}
        kind={crumb.kind}
      />
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
      <ol className="flex min-w-0 items-center">
        {collapsed.length > 0 ? (
          <li className="flex shrink-0 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('breadcrumbCollapsed', {
                  count: collapsed.length,
                })}
                className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-large px-1.5 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
              >
                <EllipsisIcon aria-hidden="true" className="size-4" />
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
            <CrumbSeparator />
          </li>
        ) : null}

        {tail.map((crumb, index) => (
          <li className="flex min-w-0 items-center" key={crumb.id}>
            {index > 0 ? <CrumbSeparator /> : null}
            <Crumb crumb={crumb} />
          </li>
        ))}
      </ol>
    </nav>
  )
}

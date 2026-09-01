'use client'

import Link from 'next/link'

import { sidebarHeading } from '@/components/app/sidebar-styles'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  title: string
  href?: string
  icon?: React.ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
  action?: React.ReactNode
  onNavigate?: () => void
  children: React.ReactNode
}>

export function SidebarSection({
  title,
  href,
  icon: Icon,
  action,
  onNavigate,
  children,
}: Props) {
  const label = (
    <>
      {Icon ? <Icon aria-hidden={true} className="size-3.5 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </>
  )

  return (
    <section className="group/section flex flex-col">
      <div className="flex items-center gap-0.5">
        <h2 className="min-w-0 flex-1">
          {href ? (
            <Link
              className={cn(
                sidebarHeading,
                'transition-colors hover:bg-surface-hover hover:text-content',
              )}
              href={href}
              onClick={onNavigate}
            >
              {label}
            </Link>
          ) : (
            <span className={sidebarHeading}>{label}</span>
          )}
        </h2>
        {action ? (
          <span className="opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100">
            {action}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

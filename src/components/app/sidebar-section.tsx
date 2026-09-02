'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useId } from 'react'

import { sidebarSectionLabel } from '@/components/app/sidebar-styles'
import { useSidebarCollapse } from '@/components/app/use-sidebar-collapse'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/icons/outline'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  title: string
  collapseId?: string
  href?: string
  icon?: React.ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
  action?: React.ReactNode
  onNavigate?: () => void
  children: React.ReactNode
}>

export function SidebarSection({
  title,
  collapseId,
  href,
  icon: Icon,
  action,
  onNavigate,
  children,
}: Props) {
  const t = useTranslations('nav')
  const contentId = useId()
  const { collapsed, toggle } = useSidebarCollapse(collapseId)
  const collapsible = collapseId !== undefined

  const marker = collapsible ? (
    <SidebarCollapseMarker
      collapsed={collapsed}
      groupName="section"
      icon={Icon}
    />
  ) : Icon ? (
    <Icon aria-hidden={true} className="size-3.5 shrink-0" />
  ) : null

  const label = (
    <>
      {marker}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </>
  )

  return (
    <section aria-label={title} className="group/section flex flex-col">
      <div className="flex items-center gap-0.5">
        {collapsible && href ? (
          <button
            aria-controls={contentId}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? t('expandNode', { title })
                : t('collapseNode', { title })
            }
            className="flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-small transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 tablet:h-7"
            onClick={toggle}
            type="button"
          >
            {marker}
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1">
          {href ? (
            <Link
              className={cn(
                sidebarSectionLabel,
                'transition-colors hover:bg-surface-hover hover:text-content',
                collapsible && 'pl-0',
              )}
              href={href}
              onClick={onNavigate}
            >
              {collapsible ? (
                <span className="min-w-0 flex-1 truncate">{title}</span>
              ) : (
                label
              )}
            </Link>
          ) : collapsible ? (
            <button
              aria-controls={contentId}
              aria-expanded={!collapsed}
              className={cn(
                sidebarSectionLabel,
                'w-full cursor-pointer text-left transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
              )}
              onClick={toggle}
              type="button"
            >
              {label}
            </button>
          ) : (
            <span className={sidebarSectionLabel}>{label}</span>
          )}
        </h2>
        {action ? (
          <span className="opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100">
            {action}
          </span>
        ) : null}
      </div>
      <div hidden={collapsed} id={contentId}>
        {collapsed ? null : children}
      </div>
    </section>
  )
}

export function SidebarCollapseMarker({
  collapsed,
  groupName,
  icon: Icon,
}: Readonly<{
  collapsed: boolean
  groupName: 'section' | 'teamspace'
  icon?: React.ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
}>) {
  const Caret = collapsed ? ChevronRightIcon : ChevronDownIcon
  const revealCaret =
    groupName === 'section'
      ? 'opacity-0 group-hover/section:opacity-100'
      : 'opacity-0 group-hover/teamspace:opacity-100'
  const hideIcon =
    groupName === 'section'
      ? 'group-hover/section:opacity-0'
      : 'group-hover/teamspace:opacity-0'

  return (
    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
      {Icon ? (
        <Icon
          aria-hidden={true}
          className={cn(
            'size-3.5 shrink-0 transition-opacity',
            collapsed ? 'opacity-0' : hideIcon,
          )}
        />
      ) : null}
      <Caret
        aria-hidden={true}
        className={cn(
          'size-3.5 shrink-0 text-content-subtle transition-opacity',
          Icon && 'absolute',
          !collapsed && revealCaret,
        )}
      />
    </span>
  )
}

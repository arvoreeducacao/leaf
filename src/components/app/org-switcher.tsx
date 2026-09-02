'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { LeafMark } from '@/components/app/leaf-mark'
import { sidebarRow } from '@/components/app/sidebar-styles'
import { ChevronDownIcon, PeopleIcon, PlusIcon } from '@/components/icons/outline'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setActiveOrganization } from '@/lib/org-actions'
import { cn } from '@/shared/utils'

export type OrganizationOption = Readonly<{ id: string; name: string }>

type Props = Readonly<{
  organizations: ReadonlyArray<OrganizationOption>
  activeOrgId: string | null
  onNavigate?: () => void
}>

function WorkspaceMark({ name }: Readonly<{ name: string | null }>) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-small bg-surface-subtle font-semibold text-caption text-content"
    >
      {name ? (
        name.trim().charAt(0).toUpperCase()
      ) : (
        <LeafMark className="size-3.5 text-brand" />
      )}
    </span>
  )
}

export function OrgSwitcher({
  organizations,
  activeOrgId,
  onNavigate,
}: Props) {
  const t = useTranslations('org')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const active =
    organizations.find((organization) => organization.id === activeOrgId) ??
    organizations[0] ??
    null

  if (organizations.length === 0) {
    return (
      <span
        className={cn(sidebarRow, 'font-medium text-content-strong')}
        data-testid="org-switcher"
      >
        <WorkspaceMark name={null} />
        <span className="min-w-0 flex-1 truncate">{tCommon('appName')}</span>
      </span>
    )
  }

  function handleChange(next: string) {
    if (next === active?.id) {
      return
    }

    setSwitchingTo(next)
    startTransition(async () => {
      const result = await setActiveOrganization(next)

      setSwitchingTo(null)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('switcherLabel')}
          className={cn(
            sidebarRow,
            'cursor-pointer font-medium text-content-strong',
          )}
          data-testid="org-switcher"
          type="button"
        >
          <WorkspaceMark name={active?.name ?? null} />
          <span className="min-w-0 flex-1 truncate">
            {active?.name ?? t('title')}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-content-subtle"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('switcherLabel')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t('switcherLabel')}
          onValueChange={handleChange}
          value={active?.id ?? ''}
        >
          {organizations.map((organization) => (
            <DropdownMenuRadioItem
              disabled={pending && switchingTo !== organization.id}
              key={organization.id}
              value={organization.id}
            >
              <span className="truncate">{organization.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/org" onClick={onNavigate}>
            <PeopleIcon aria-hidden="true" />
            {t('manageLink')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/org?new=1" onClick={onNavigate}>
            <PlusIcon aria-hidden="true" />
            {t('create')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <span aria-live="polite" className="sr-only" role="status">
        {pending ? t('switching') : ''}
      </span>
    </DropdownMenu>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { AddIcon, CaretDownIcon, TeamIcon } from '@/components/icons'
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

export type OrganizationOption = Readonly<{ id: string; name: string }>

type Props = Readonly<{
  organizations: ReadonlyArray<OrganizationOption>
  activeOrgId: string | null
  onNavigate?: () => void
}>

export function OrgSwitcher({
  organizations,
  activeOrgId,
  onNavigate,
}: Props) {
  const t = useTranslations('org')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const active =
    organizations.find((organization) => organization.id === activeOrgId) ??
    organizations[0] ??
    null

  if (organizations.length === 0) {
    return (
      <Link
        className="flex items-center gap-2 rounded-large px-3 py-2 font-bold text-body-small text-content-strong transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        href="/org"
        onClick={onNavigate}
      >
        <AddIcon aria-hidden="true" className="size-4 shrink-0" />
        {t('create')}
      </Link>
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
          className="flex w-full items-center gap-2 rounded-large px-3 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          data-testid="org-switcher"
          type="button"
        >
          <TeamIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-content"
          />
          <span className="min-w-0 flex-1 truncate font-bold text-body-small text-content-strong">
            {active?.name ?? t('title')}
          </span>
          <CaretDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-content"
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
            <TeamIcon aria-hidden="true" />
            {t('manageLink')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/org?new=1" onClick={onNavigate}>
            <AddIcon aria-hidden="true" />
            {t('create')}
          </Link>
        </DropdownMenuItem>

        <span aria-live="polite" className="sr-only" role="status">
          {pending ? t('switching') : ''}
        </span>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

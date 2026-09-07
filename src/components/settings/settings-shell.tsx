'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'

import {
  sidebarIcon,
  sidebarRow,
  sidebarRowActive,
  sidebarSectionLabel,
} from '@/components/app/sidebar-styles'
import { CancelIcon, PluginIcon } from '@/components/icons'
import { SlidersIcon } from '@/components/icons/outline'
import { OrganizationMark } from '@/components/org/organization-mark'
import { ButtonIcon } from '@/components/ui/button-icon'
import { UserAvatar } from '@/components/ui/user-avatar'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  user: { id: string; name: string; email: string; image: string | null }
  orgName: string | null
  orgIcon: string | null
  connectedAppsEnabled: boolean
  children: React.ReactNode
}>

const openLayerSelector = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="select-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="dropdown-menu-content"]',
].join(', ')

function SettingsGroup({
  children,
  title,
}: Readonly<{ children: React.ReactNode; title: string }>) {
  return (
    <div className="flex shrink-0 flex-row items-center gap-1 tablet:flex-col tablet:items-stretch">
      <span className={cn(sidebarSectionLabel, 'hidden tablet:flex')}>
        {title}
      </span>
      {children}
    </div>
  )
}

function SettingsNavLink({
  children,
  current,
  href,
}: Readonly<{ children: React.ReactNode; current: boolean; href: string }>) {
  return (
    <Link
      aria-current={current ? 'page' : undefined}
      className={cn(
        sidebarRow,
        'w-auto shrink-0 px-2.5 tablet:w-full tablet:px-2',
        current && sidebarRowActive,
      )}
      href={href}
    >
      {children}
    </Link>
  )
}

export function SettingsShell({
  children,
  connectedAppsEnabled,
  orgIcon,
  orgName,
  user,
}: Props) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tOrg = useTranslations('org')
  const pathname = usePathname()
  const router = useRouter()

  const close = useCallback(() => {
    if (window.history.length > 1) {
      router.back()

      return
    }

    router.push('/')
  }, [router])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      if (document.querySelector(openLayerSelector)) {
        return
      }

      close()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-overlay tablet:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close()
        }
      }}
      role="presentation"
    >
      <div
        aria-label={t('title')}
        className="relative flex h-full max-h-[860px] w-full max-w-[1200px] flex-col overflow-hidden bg-surface-card tablet:h-full tablet:flex-row tablet:rounded-xlarge tablet:shadow-center-xlarge"
        role="dialog"
      >
        <nav
          aria-label={t('title')}
          className="flex shrink-0 flex-row gap-1 overflow-x-auto border-line-subtle border-b bg-surface-sunken p-2 pr-13 tablet:w-60 tablet:flex-col tablet:gap-0.5 tablet:overflow-x-visible tablet:overflow-y-auto tablet:border-r tablet:border-b-0 tablet:p-3 tablet:pr-3"
        >
          <SettingsGroup title={t('groupAccount')}>
            <SettingsNavLink current={pathname === '/account'} href="/account">
              <UserAvatar
                className="size-5"
                email={user.email}
                image={user.image}
                name={user.name}
                userId={user.id}
              />
              <span className="min-w-0 flex-1 truncate">
                {user.name || user.email}
              </span>
            </SettingsNavLink>
            <SettingsNavLink
              current={pathname === '/preferences'}
              href="/preferences"
            >
              <SlidersIcon aria-hidden="true" className={sidebarIcon} />
              <span className="min-w-0 flex-1 truncate">
                {t('preferences')}
              </span>
            </SettingsNavLink>
          </SettingsGroup>

          <SettingsGroup title={t('groupWorkspace')}>
            <SettingsNavLink current={pathname === '/org'} href="/org">
              <OrganizationMark icon={orgIcon} name={orgName} />
              <span className="min-w-0 flex-1 truncate">{tOrg('title')}</span>
            </SettingsNavLink>
          </SettingsGroup>

          {connectedAppsEnabled ? (
            <SettingsGroup title={t('groupResources')}>
              <SettingsNavLink
                current={pathname === '/connected-apps'}
                href="/connected-apps"
              >
                <PluginIcon aria-hidden="true" className={sidebarIcon} />
                <span className="min-w-0 flex-1 truncate">
                  {t('connectedApps')}
                </span>
              </SettingsNavLink>
            </SettingsGroup>
          ) : null}
        </nav>

        <ButtonIcon
          aria-label={tCommon('close')}
          className="absolute top-2.5 right-2.5 z-10"
          data-testid="close-settings"
          onClick={close}
          size="large"
          variant="ghost"
        >
          <CancelIcon aria-hidden="true" />
        </ButtonIcon>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[46rem] flex-col px-4 py-8 tablet:px-12 tablet:py-11">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

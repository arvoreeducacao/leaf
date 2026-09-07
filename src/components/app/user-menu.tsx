'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  ArrowRightIcon,
  DownloadIcon,
  GlobeIcon,
  MoonFirstQuarterIcon,
  MoonIcon,
  PluginIcon,
  Sun3Icon,
  SyncIcon,
  TeamIcon,
  UserIcon,
} from '@/components/icons'
import { SlidersIcon } from '@/components/icons/outline'
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
import { UserAvatar } from '@/components/ui/user-avatar'
import { sidebarRow } from '@/components/app/sidebar-styles'
import { clearOfflineCaches } from '@/components/app/service-worker-registration'
import { locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale-action'
import { authClient } from '@/lib/auth-client'
import { wipeOfflineData } from '@/lib/offline/wipe'
import { useInstallPrompt } from '@/shared/hooks/use-install-prompt'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  userId: string
  name: string
  email: string
  image: string | null
  locale: string
  compact?: boolean
  connectedAppsEnabled?: boolean
}>

const themeOptions = [
  { value: 'light', labelKey: 'themeLight', Icon: Sun3Icon },
  { value: 'dark', labelKey: 'themeDark', Icon: MoonIcon },
  { value: 'system', labelKey: 'themeSystem', Icon: MoonFirstQuarterIcon },
] as const

const localeLabelKeys = {
  'pt-BR': 'localePtBR',
  'en-US': 'localeEnUS',
} as const

export function UserMenu({
  userId,
  name,
  email,
  image,
  locale,
  compact = false,
  connectedAppsEnabled = false,
}: Props) {
  const t = useTranslations('settings')
  const tAuth = useTranslations('auth')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { installable, install } = useInstallPrompt()
  const [mounted, setMounted] = useState(false)
  const [pending, setPending] = useState(false)
  const [switching, startSwitching] = useTransition()
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSignOut() {
    setPending(true)
    const result = await authClient.signOut()

    if (result.error) {
      setPending(false)
      toast.error(tAuth('signOutFailed'))
      return
    }

    await wipeOfflineData()
    await clearOfflineCaches()

    router.push('/login')
    router.refresh()
  }

  function handleLocaleChange(next: string) {
    if (next === locale) {
      return
    }

    setSwitchingTo(next)
    startSwitching(async () => {
      await setUserLocale(next)
      router.refresh()
      setSwitchingTo(null)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={compact ? name || email : undefined}
          className={cn(
            sidebarRow,
            'cursor-pointer',
            compact && 'w-auto justify-center px-1.5',
          )}
          data-testid="user-menu-trigger"
          type="button"
        >
          <UserAvatar
            email={email}
            image={image}
            name={name}
            userId={userId}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              compact && 'sr-only',
            )}
          >
            {name || email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-body-small text-content-strong">
            {name || email}
          </span>
          <span className="block truncate font-normal text-caption text-content-subtle">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon aria-hidden="true" />
            {t('account')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/preferences">
            <SlidersIcon aria-hidden="true" />
            {t('preferences')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/org">
            <TeamIcon aria-hidden="true" />
            {tNav('organizationLink')}
          </Link>
        </DropdownMenuItem>
        {connectedAppsEnabled ? (
          <DropdownMenuItem asChild>
            <Link href="/connected-apps">
              <PluginIcon aria-hidden="true" />
              {t('connectedApps')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {installable ? (
          <DropdownMenuItem data-testid="install-app" onSelect={() => void install()}>
            <DownloadIcon aria-hidden="true" />
            {t('installApp')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={pending} onSelect={handleSignOut}>
          <ArrowRightIcon aria-hidden="true" />
          {t('signOut')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t('appearance')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t('appearance')}
          onValueChange={setTheme}
          value={mounted ? (theme ?? 'system') : 'system'}
        >
          {themeOptions.map(({ value, labelKey, Icon }) => (
            <DropdownMenuRadioItem
              data-testid={`theme-${value}`}
              key={value}
              value={value}
            >
              <Icon aria-hidden="true" className="mr-2 size-4 shrink-0" />
              {t(labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t('language')}
          onValueChange={handleLocaleChange}
          value={locale}
        >
          {locales.map((value) => (
            <DropdownMenuRadioItem
              data-testid={`locale-${value}`}
              key={value}
              value={value}
            >
              {switching && switchingTo === value ? (
                <SyncIcon
                  aria-hidden="true"
                  className="mr-2 size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
                />
              ) : (
                <GlobeIcon aria-hidden="true" className="mr-2 size-4 shrink-0" />
              )}
              {t(localeLabelKeys[value])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <span aria-live="polite" className="sr-only" role="status">
          {switching ? t('switchingLanguage') : ''}
        </span>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

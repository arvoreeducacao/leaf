'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  ArrowRightIcon,
  GlobeIcon,
  MoonFirstQuarterIcon,
  MoonIcon,
  Sun3Icon,
  SyncIcon,
  TeamIcon,
} from '@/components/icons'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale-action'
import { authClient } from '@/lib/auth-client'

type Props = Readonly<{
  name: string
  email: string
  locale: string
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

function initials(name: string, email: string) {
  const source = name.trim() || email
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return '?'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function UserMenu({ name, email, locale }: Props) {
  const t = useTranslations('settings')
  const tAuth = useTranslations('auth')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
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
          className="flex w-full items-center gap-3 rounded-large p-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          data-testid="user-menu-trigger"
          type="button"
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-brand-surface-strong font-bold text-caption text-content-strong">
              {initials(name, email)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-body-small text-content-strong">
              {name || email}
            </span>
            <span className="block truncate text-caption text-content">
              {email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('account')}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/org">
            <TeamIcon aria-hidden="true" />
            {tNav('organizationLink')}
          </Link>
        </DropdownMenuItem>
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

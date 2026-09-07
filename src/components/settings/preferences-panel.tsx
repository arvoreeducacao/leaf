'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { DownloadIcon } from '@/components/icons'
import {
  SettingsRow,
  SettingsSection,
} from '@/components/settings/settings-panel'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { locales } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale-action'
import { useInstallPrompt } from '@/shared/hooks/use-install-prompt'

type Props = Readonly<{ locale: string }>

const themeValues = ['light', 'dark', 'system'] as const

const themeLabelKeys = {
  dark: 'themeDark',
  light: 'themeLight',
  system: 'themeSystem',
} as const

const localeLabelKeys = {
  'en-US': 'localeEnUS',
  'pt-BR': 'localePtBR',
} as const

export function PreferencesPanel({ locale }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { installable, install } = useInstallPrompt()
  const [mounted, setMounted] = useState(false)
  const [switching, startSwitching] = useTransition()
  const themeId = useId()
  const localeId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleLocaleChange(next: string) {
    if (next === locale) {
      return
    }

    startSwitching(async () => {
      await setUserLocale(next)
      router.refresh()
    })
  }

  return (
    <>
      <SettingsSection title={t('appearance')}>
        <SettingsRow
          control={
            <Select
              onValueChange={setTheme}
              value={mounted ? (theme ?? 'system') : 'system'}
            >
              <SelectTrigger className="w-45" id={themeId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themeValues.map((value) => (
                  <SelectItem
                    data-testid={`preferences-theme-${value}`}
                    key={value}
                    value={value}
                  >
                    {t(themeLabelKeys[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          description={t('themeHint')}
          htmlFor={themeId}
          title={t('themeLabel')}
        />
      </SettingsSection>

      <SettingsSection title={t('sectionLanguage')}>
        <SettingsRow
          control={
            <Select
              disabled={switching}
              onValueChange={handleLocaleChange}
              value={locale}
            >
              <SelectTrigger className="w-45" id={localeId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((value) => (
                  <SelectItem
                    data-testid={`preferences-locale-${value}`}
                    key={value}
                    value={value}
                  >
                    {t(localeLabelKeys[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          description={t('languageHint')}
          htmlFor={localeId}
          title={t('language')}
        />
        <span aria-live="polite" className="sr-only" role="status">
          {switching ? t('switchingLanguage') : ''}
        </span>
      </SettingsSection>

      {mounted && installable ? (
        <SettingsSection title={t('sectionApp')}>
          <SettingsRow
            control={
              <Button
                data-testid="install-app-preferences"
                onClick={() => void install()}
                type="button"
                variant="secondary"
              >
                <DownloadIcon aria-hidden="true" />
                {t('installApp')}
              </Button>
            }
            description={t('installAppHint')}
            title={t('installApp')}
          />
        </SettingsSection>
      ) : null}
    </>
  )
}

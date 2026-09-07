import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { PreferencesPanel } from '@/components/settings/preferences-panel'
import {
  SettingsHeader,
  SettingsPanel,
} from '@/components/settings/settings-panel'
import { getSession } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('preferences') }
}

export default async function PreferencesPage() {
  const t = await getTranslations('settings')
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const locale = await getLocale()

  return (
    <>
      <SettingsHeader
        description={t('preferencesSubtitle')}
        title={t('preferences')}
      />

      <SettingsPanel>
        <PreferencesPanel locale={locale} />
      </SettingsPanel>
    </>
  )
}

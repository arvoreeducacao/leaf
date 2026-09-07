import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AccountForm } from '@/components/account/account-form'
import { PasskeyManager } from '@/components/account/passkey-manager'
import {
  SettingsHeader,
  SettingsPanel,
} from '@/components/settings/settings-panel'
import { getSession } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('account') }
}

export default async function AccountPage() {
  const t = await getTranslations('account')
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <>
      <SettingsHeader description={t('subtitle')} title={t('title')} />

      <SettingsPanel>
        <AccountForm
          email={session.user.email}
          image={session.user.image ?? null}
          name={session.user.name}
          userId={session.user.id}
        />

        <PasskeyManager />
      </SettingsPanel>
    </>
  )
}

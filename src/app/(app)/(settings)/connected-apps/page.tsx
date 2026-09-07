import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { ConnectedAppsManager } from '@/components/oauth/connected-apps-manager'
import {
  SettingsHeader,
  SettingsPanel,
} from '@/components/settings/settings-panel'
import { getSession } from '@/lib/auth'
import { listConnectedApps } from '@/lib/connected-apps'
import { isMcpEnabled, mcpResourceUrl } from '@/lib/mcp-config'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('connectedApps') }
}

export default async function ConnectedAppsPage() {
  const t = await getTranslations('connectedApps')

  if (!isMcpEnabled()) {
    notFound()
  }

  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const apps = await listConnectedApps(session.user.id)

  return (
    <>
      <SettingsHeader description={t('subtitle')} title={t('title')} />

      <SettingsPanel>
        <ConnectedAppsManager apps={apps} mcpUrl={mcpResourceUrl()} />
      </SettingsPanel>
    </>
  )
}

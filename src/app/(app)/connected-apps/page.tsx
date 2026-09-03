import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { ConnectedAppsManager } from '@/components/oauth/connected-apps-manager'
import { getSession } from '@/lib/auth'
import { listConnectedApps } from '@/lib/connected-apps'
import { isMcpEnabled, mcpResourceUrl } from '@/lib/mcp-config'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('connectedApps') }
}

export default async function ConnectedAppsPage() {
  if (!isMcpEnabled()) {
    notFound()
  }

  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const apps = await listConnectedApps(session.user.id)

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8 tablet:px-8 tablet:py-10">
      <ConnectedAppsManager apps={apps} mcpUrl={mcpResourceUrl()} />
    </div>
  )
}

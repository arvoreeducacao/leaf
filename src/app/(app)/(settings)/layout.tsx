import { redirect } from 'next/navigation'

import { SettingsShell } from '@/components/settings/settings-shell'
import { readActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { isMcpEnabled } from '@/lib/mcp-config'
import { listMemberships } from '@/lib/organizations'

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const memberships = await listMemberships(session.user.id)
  const activeOrgId = await readActiveOrgId()
  const membership =
    memberships.find((item) => item.orgId === activeOrgId) ??
    memberships[0] ??
    null

  return (
    <SettingsShell
      connectedAppsEnabled={isMcpEnabled()}
      orgIcon={membership?.orgIcon ?? null}
      orgName={membership?.orgName ?? null}
      user={{
        email: session.user.email,
        id: session.user.id,
        image: session.user.image ?? null,
        name: session.user.name,
      }}
    >
      {children}
    </SettingsShell>
  )
}

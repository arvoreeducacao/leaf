'use server'

import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { revokeConnectedApp } from '@/lib/connected-apps'
import { isMcpEnabled } from '@/lib/mcp-config'

export type ConnectedAppActionResult =
  | { ok: true }
  | { ok: false; error: string }

const consentIdPattern = /^[A-Za-z0-9_-]{1,64}$/

export async function revokeConnectedAppAccess(
  consentId: string,
): Promise<ConnectedAppActionResult> {
  const t = await getTranslations('connectedApps')

  if (!isMcpEnabled()) {
    return { ok: false, error: t('errorNotFound') }
  }

  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (!consentIdPattern.test(consentId)) {
    return { ok: false, error: t('errorNotFound') }
  }

  const revoked = await revokeConnectedApp(session.user.id, consentId)

  if (!revoked) {
    return { ok: false, error: t('errorNotFound') }
  }

  revalidatePath('/connected-apps')

  return { ok: true }
}

import { cookies } from 'next/headers'

import type { Membership } from '@/lib/organizations'
import { resolveMembership } from '@/lib/organizations'

export const activeOrgCookie = 'leaf-active-org'

const oneYearInSeconds = 60 * 60 * 24 * 365

export async function readActiveOrgId(): Promise<string | null> {
  const store = await cookies()

  return store.get(activeOrgCookie)?.value ?? null
}

export async function getActiveMembership(
  userId: string,
): Promise<Membership | null> {
  return resolveMembership(userId, await readActiveOrgId())
}

export async function writeActiveOrgId(orgId: string) {
  const store = await cookies()

  store.set(activeOrgCookie, orgId, {
    httpOnly: true,
    maxAge: oneYearInSeconds,
    path: '/',
    sameSite: 'lax',
  })
}

export async function clearActiveOrgId() {
  const store = await cookies()

  store.delete(activeOrgCookie)
}

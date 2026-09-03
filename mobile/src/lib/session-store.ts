import { authClient } from '@/lib/auth-client'

const sessionCookieSuffix = 'session_token='

export function hasSessionToken(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) {
    return false
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.includes(sessionCookieSuffix))
}

export async function hasStoredSession(): Promise<boolean> {
  return hasSessionToken(await authClient.getCookie())
}

import { config } from '@/constants/config'
import { authClient } from '@/lib/auth-client'

export type HandoffResult =
  | Readonly<{ kind: 'entry'; url: string }>
  | Readonly<{ kind: 'signed-out' }>
  | Readonly<{ kind: 'unreachable' }>

export function mobileEntryUrl(token: string): string {
  const url = new URL(config.mobileEntryPath, config.leafUrl)
  url.searchParams.set('token', token)

  return url.toString()
}

export async function requestWebViewEntry(): Promise<HandoffResult> {
  const cookieHeader = await authClient.getCookie()

  if (!cookieHeader) {
    return { kind: 'signed-out' }
  }

  const result = await authClient.oneTimeToken.generate()

  if (result.error) {
    const status = result.error.status ?? 0

    return status === 401 || status === 403
      ? { kind: 'signed-out' }
      : { kind: 'unreachable' }
  }

  return { kind: 'entry', url: mobileEntryUrl(result.data.token) }
}

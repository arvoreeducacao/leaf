const localHostPattern = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export function requestOrigin(requestHeaders: Headers): string | null {
  const forwardedHost = requestHeaders.get('x-forwarded-host')?.split(',')[0]
  const host = (forwardedHost ?? requestHeaders.get('host') ?? '').trim()

  if (!host) {
    return null
  }

  const forwardedProtocol = requestHeaders
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  const protocol =
    forwardedProtocol || (localHostPattern.test(host) ? 'http' : 'https')

  return `${protocol}://${host}`
}

export function buildSsoSignOutUrl(
  issuer: string,
  origin: string | null,
): string {
  const signOut = `${issuer.replace(/\/+$/, '')}/auth/logout`

  if (!origin) {
    return signOut
  }

  return `${signOut}?redirect=${encodeURIComponent(`${origin}/login`)}`
}

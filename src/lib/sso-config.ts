const defaultProviderId = 'sso'

const defaultProviderName = 'SSO'

export type SsoConfig = Readonly<{
  providerId: string
  providerName: string
  issuer: string
  clientId: string
  clientSecret: string | undefined
  authorizationUrl: string
  tokenUrl: string
  logoutUrl: string | null
}>

type Env = Readonly<Record<string, string | undefined>>

function trimmed(env: Env, name: string): string {
  return env[name]?.trim() ?? ''
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function ssoConfig(env: Env = process.env): SsoConfig | null {
  const clientId = trimmed(env, 'LEAF_SSO_CLIENT_ID')
  const issuer = withoutTrailingSlash(trimmed(env, 'LEAF_SSO_ISSUER'))

  if (clientId.length === 0 || issuer.length === 0) {
    return null
  }

  const clientSecret = trimmed(env, 'LEAF_SSO_CLIENT_SECRET')
  const logoutUrl = trimmed(env, 'LEAF_SSO_LOGOUT_URL')

  return {
    authorizationUrl:
      trimmed(env, 'LEAF_SSO_AUTHORIZATION_URL') || `${issuer}/oauth2/authorize`,
    clientId,
    clientSecret: clientSecret.length > 0 ? clientSecret : undefined,
    issuer,
    logoutUrl: logoutUrl.length > 0 ? logoutUrl : null,
    providerId: trimmed(env, 'LEAF_SSO_PROVIDER_ID') || defaultProviderId,
    providerName: trimmed(env, 'LEAF_SSO_PROVIDER_NAME') || defaultProviderName,
    tokenUrl: trimmed(env, 'LEAF_SSO_TOKEN_URL') || `${issuer}/oauth2/token`,
  }
}

export function googleConfig(
  env: Env = process.env,
): Readonly<{ clientId: string; clientSecret: string }> | null {
  const clientId = trimmed(env, 'GOOGLE_CLIENT_ID')
  const clientSecret = trimmed(env, 'GOOGLE_CLIENT_SECRET')

  if (clientId.length === 0 || clientSecret.length === 0) {
    return null
  }

  return { clientId, clientSecret }
}

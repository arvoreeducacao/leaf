const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export type RegistrationBody = Readonly<Record<string, unknown>>

export type RegistrationDecision =
  | Readonly<{ ok: true; body: Record<string, unknown> }>
  | Readonly<{ ok: false; error: string; description: string }>

function reject(error: string, description: string): RegistrationDecision {
  return { ok: false, error, description }
}

function classifyRedirectUri(value: unknown): 'https' | 'loopback' | 'invalid' {
  if (typeof value !== 'string') {
    return 'invalid'
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return 'invalid'
  }

  if (url.protocol === 'https:' && !loopbackHosts.has(url.hostname)) {
    return 'https'
  }

  if (url.protocol === 'http:' && loopbackHosts.has(url.hostname)) {
    return 'loopback'
  }

  return 'invalid'
}

export function validateDynamicClientRegistration(
  body: RegistrationBody,
): RegistrationDecision {
  const authMethod = body.token_endpoint_auth_method

  if (authMethod !== undefined && authMethod !== 'none') {
    return reject(
      'invalid_client_metadata',
      'only public clients (token_endpoint_auth_method "none") can register',
    )
  }

  if ('client_secret' in body) {
    return reject(
      'invalid_client_metadata',
      'client_secret is not accepted at registration',
    )
  }

  const redirectUris = body.redirect_uris

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return reject('invalid_redirect_uri', 'redirect_uris is required')
  }

  const kinds = new Set(redirectUris.map(classifyRedirectUri))

  if (kinds.has('invalid')) {
    return reject(
      'invalid_redirect_uri',
      'redirect_uris must use https, or http on localhost, 127.0.0.1 or [::1]',
    )
  }

  if (kinds.size > 1) {
    return reject(
      'invalid_redirect_uri',
      'redirect_uris must not mix https and loopback addresses',
    )
  }

  const grantTypes = body.grant_types

  if (
    Array.isArray(grantTypes) &&
    grantTypes.some(
      (grant) => grant !== 'authorization_code' && grant !== 'refresh_token',
    )
  ) {
    return reject(
      'invalid_client_metadata',
      'only authorization_code and refresh_token grants are available',
    )
  }

  return {
    ok: true,
    body: {
      ...body,
      token_endpoint_auth_method: 'none',
      application_type: kinds.has('loopback') ? 'native' : 'web',
    },
  }
}

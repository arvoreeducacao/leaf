import {
  type JWTPayload,
  type JWTVerifyGetKey,
  createRemoteJWKSet,
  errors,
  jwtVerify,
} from 'jose'

import type { SsoConfig } from '@/lib/sso-config'

export type SsoIdTokenPolicy = Readonly<{
  keys: JWTVerifyGetKey
  issuer: string
  audience: string
}>

export type SsoProfile = JWTPayload &
  Readonly<{
    id: string
    sub: string
    email: string
    emailVerified: boolean
    image: string | undefined
    name: string | undefined
  }>

export function ssoIdTokenPolicy(
  config: Pick<SsoConfig, 'jwksUrl' | 'idTokenIssuer' | 'idTokenAudience'>,
): SsoIdTokenPolicy {
  return {
    keys: createRemoteJWKSet(new URL(config.jwksUrl)),
    issuer: config.idTokenIssuer,
    audience: config.idTokenAudience,
  }
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export async function verifySsoIdToken(
  idToken: string | undefined,
  policy: SsoIdTokenPolicy,
  now: Date = new Date(),
): Promise<SsoProfile | null> {
  if (!idToken) {
    return null
  }

  try {
    const { payload } = await jwtVerify(idToken, policy.keys, {
      audience: policy.audience,
      currentDate: now,
      issuer: policy.issuer,
      requiredClaims: ['exp'],
    })

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.email !== 'string' ||
      payload.email.length === 0
    ) {
      return null
    }

    return {
      ...payload,
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      image: optionalString(payload.picture),
      name: optionalString(payload.name),
    }
  } catch (error) {
    if (
      error instanceof errors.JOSEError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      return null
    }

    throw error
  }
}

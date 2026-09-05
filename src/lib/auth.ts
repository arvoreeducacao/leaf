import { expo } from '@better-auth/expo'
import { oauthProvider } from '@better-auth/oauth-provider'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth, jwt, oneTimeToken } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'

import { db } from '@/db'
import * as schema from '@/db/schema'
import {
  emailDomainErrorCode,
  emailDomainPolicy,
  isEmailDomainAllowed,
} from '@/lib/email-domain'
import {
  authIssuer,
  isMcpEnabled,
  mcpAccessTokenTtlSeconds,
  mcpResourceUrl,
  mcpScopes,
} from '@/lib/mcp-config'
import { validateDynamicClientRegistration } from '@/lib/mcp/client-registration'
import { mobileTrustedOrigins } from '@/lib/mobile-auth'
import { googleConfig, ssoConfig } from '@/lib/sso-config'
import { buildSsoSignOutUrl, requestOrigin } from '@/lib/sso-sign-out'

const guardedPaths = new Set(['/sign-up/email', '/sign-in/email'])

const clientRegistrationPath = '/oauth2/register'

export const oauthConsentPath = '/oauth/consent'

function domainError() {
  const { primaryDomain } = emailDomainPolicy()

  return new APIError('FORBIDDEN', {
    code: emailDomainErrorCode,
    message: primaryDomain
      ? `Only @${primaryDomain} accounts can use Leaf`
      : 'This email domain is not allowed',
  })
}

function guardEmail(email: unknown) {
  const { domains } = emailDomainPolicy()

  if (domains.length === 0 || isEmailDomainAllowed(email, domains)) {
    return
  }

  throw domainError()
}

async function guardUserId(userId: string) {
  const { domains } = emailDomainPolicy()

  if (domains.length === 0) {
    return
  }

  const owner = await db.query.user.findFirst({
    columns: { email: true },
    where: eq(schema.user.id, userId),
  })

  guardEmail(owner?.email)
}

function guardClientRegistration(body: unknown) {
  const decision = validateDynamicClientRegistration(
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {},
  )

  if (!decision.ok) {
    throw new APIError('BAD_REQUEST', {
      error: decision.error,
      error_description: decision.description,
    })
  }

  return decision.body
}

export function authAccessConfig() {
  const { active, primaryDomain } = emailDomainPolicy()

  return {
    googleEnabled: google !== null,
    restrictedDomain: active ? primaryDomain : null,
    sso: sso
      ? { providerId: sso.providerId, providerName: sso.providerName }
      : null,
  }
}

export async function ssoSignOutUrl() {
  if (!sso?.logoutUrl) {
    return null
  }

  return buildSsoSignOutUrl(sso.logoutUrl, requestOrigin(await headers()))
}

function ssoUserName(profile: { email?: string | null; name?: unknown }) {
  if (typeof profile.name === 'string' && profile.name.trim()) {
    return profile.name.trim()
  }

  return profile.email?.split('@')[0] ?? 'user'
}

const sso = ssoConfig()

const google = googleConfig()

const ssoPlugin = sso
  ? genericOAuth({
      config: [
        {
          accountIssuer: sso.issuer,
          authorizationUrl: sso.authorizationUrl,
          clientId: sso.clientId,
          clientSecret: sso.clientSecret,
          mapProfileToUser: (profile) => ({
            emailVerified: true,
            name: ssoUserName(profile),
          }),
          providerId: sso.providerId,
          scopes: ['openid', 'profile', 'email'],
          tokenUrl: sso.tokenUrl,
        },
      ],
    })
  : null

function passkeyRelyingParty() {
  const issuer = authIssuer()

  try {
    return {
      origin: issuer,
      rpID: new URL(issuer).hostname,
      rpName: 'Leaf',
    }
  } catch {
    return { rpName: 'Leaf' }
  }
}

function mcpAuthorizationServerPlugins() {
  if (!isMcpEnabled()) {
    return []
  }

  const resource = mcpResourceUrl()

  return [
    jwt({
      disableSettingJwtHeader: true,
      jwks: { keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' } },
      jwt: { issuer: authIssuer(), expirationTime: mcpAccessTokenTtlSeconds },
    }),
    oauthProvider({
      loginPage: '/login',
      consentPage: oauthConsentPath,
      scopes: [...mcpScopes],
      grantTypes: ['authorization_code', 'refresh_token'],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: [...mcpScopes],
      accessTokenExpiresIn: mcpAccessTokenTtlSeconds,
      resources: [
        {
          identifier: resource,
          name: 'Leaf MCP',
          accessTokenTtl: mcpAccessTokenTtlSeconds,
          allowedScopes: [...mcpScopes],
        },
      ],
      clientRegistrationDefaultResources: [resource],
      enforcePerClientResources: true,
      rateLimit: {
        register: { window: 60, max: 5 },
        token: { window: 60, max: 20 },
      },
    }),
  ]
}

export const auth = betterAuth({
  appName: 'Leaf',
  trustedOrigins: mobileTrustedOrigins(process.env.NODE_ENV),
  database: drizzleAdapter(db, {
    provider: 'mysql',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      passkey: schema.passkey,
      jwks: schema.jwks,
      oauthClient: schema.oauthClients,
      oauthResource: schema.oauthResources,
      oauthClientResource: schema.oauthClientResources,
      oauthRefreshToken: schema.oauthRefreshTokens,
      oauthAccessToken: schema.oauthAccessTokens,
      oauthConsent: schema.oauthConsents,
      oauthClientAssertion: schema.oauthClientAssertions,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: sso !== null,
  },
  socialProviders: google ? { google } : {},
  account: {
    accountLinking: {
      enabled: true,
      requireLocalEmailVerified: true,
      trustedProviders: [
        ...(sso ? [sso.providerId] : []),
        ...(google ? ['google'] : []),
      ],
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === clientRegistrationPath) {
        return { context: { body: guardClientRegistration(ctx.body) } }
      }

      if (!guardedPaths.has(ctx.path)) {
        return
      }

      guardEmail(ctx.body?.email)
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (candidate) => {
          guardEmail(candidate.email)

          return { data: candidate }
        },
      },
    },
    session: {
      create: {
        before: async (candidate) => {
          await guardUserId(candidate.userId)

          return { data: candidate }
        },
      },
    },
  },
  plugins: [
    ...(ssoPlugin ? [ssoPlugin] : []),
    passkey(passkeyRelyingParty()),
    ...mcpAuthorizationServerPlugins(),
    expo(),
    oneTimeToken({ storeToken: 'hashed' }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/db'
import * as schema from '@/db/schema'
import {
  emailDomainErrorCode,
  emailDomainPolicy,
  isEmailDomainAllowed,
} from '@/lib/email-domain'
import { buildSsoSignOutUrl, requestOrigin } from '@/lib/sso-sign-out'

const guardedPaths = new Set(['/sign-up/email', '/sign-in/email'])

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

export const arvoreSsoProviderId = 'arvore'

const defaultSsoIssuer = 'https://auth.arvore.com.br/api-arvore'

export function arvoreSsoCredentials() {
  const clientId = process.env.ARVORE_SSO_CLIENT_ID?.trim()

  if (!clientId) {
    return null
  }

  const clientSecret = process.env.ARVORE_SSO_CLIENT_SECRET?.trim()
  const issuer = (process.env.ARVORE_SSO_ISSUER?.trim() || defaultSsoIssuer)
    .replace(/\/+$/, '')

  return {
    clientId,
    clientSecret: clientSecret || undefined,
    issuer,
  }
}

export function authAccessConfig() {
  const { active, primaryDomain } = emailDomainPolicy()

  return {
    restrictedDomain: active ? primaryDomain : null,
    ssoEnabled: arvoreSsoCredentials() !== null,
  }
}

export async function ssoSignOutUrl() {
  const credentials = arvoreSsoCredentials()

  if (!credentials) {
    return null
  }

  return buildSsoSignOutUrl(credentials.issuer, requestOrigin(await headers()))
}

function ssoUserName(profile: { email?: string | null; name?: unknown }) {
  if (typeof profile.name === 'string' && profile.name.trim()) {
    return profile.name.trim()
  }

  return profile.email?.split('@')[0] ?? arvoreSsoProviderId
}

const sso = arvoreSsoCredentials()

const ssoPlugin = sso
  ? genericOAuth({
      config: [
        {
          accountIssuer: sso.issuer,
          authorizationUrl: `${sso.issuer}/oauth2/authorize`,
          clientId: sso.clientId,
          clientSecret: sso.clientSecret,
          mapProfileToUser: (profile) => ({
            emailVerified: true,
            name: ssoUserName(profile),
          }),
          providerId: arvoreSsoProviderId,
          scopes: ['openid', 'profile', 'email'],
          tokenUrl: `${sso.issuer}/oauth2/token`,
        },
      ],
    })
  : null

export const auth = betterAuth({
  appName: 'Leaf',
  database: drizzleAdapter(db, {
    provider: 'mysql',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: sso !== null,
  },
  account: {
    accountLinking: {
      enabled: true,
      requireLocalEmailVerified: sso !== null,
      trustedProviders: [arvoreSsoProviderId],
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
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
  plugins: ssoPlugin ? [ssoPlugin, nextCookies()] : [nextCookies()],
})

export type Session = typeof auth.$Infer.Session

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

import { db } from '@/db'
import * as schema from '@/db/schema'
import {
  emailDomainErrorCode,
  emailDomainPolicy,
  isEmailDomainAllowed,
} from '@/lib/email-domain'

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

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    return null
  }

  const { domains } = emailDomainPolicy()

  return {
    clientId,
    clientSecret,
    ...(domains.length === 1 ? { hd: domains[0] } : {}),
  }
}

export function authAccessConfig() {
  const { active, primaryDomain } = emailDomainPolicy()

  return {
    restrictedDomain: active ? primaryDomain : null,
    googleEnabled: googleCredentials() !== null,
  }
}

const google = googleCredentials()

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
  },
  account: {
    accountLinking: {
      enabled: true,
      requireLocalEmailVerified: false,
      trustedProviders: ['google'],
    },
  },
  socialProviders: google ? { google } : {},
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
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

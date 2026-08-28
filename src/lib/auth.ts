import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers'

import { db } from '@/db'
import * as schema from '@/db/schema'

export const auth = betterAuth({
  appName: 'Leaf',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
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
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

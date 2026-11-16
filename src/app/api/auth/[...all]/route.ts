import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/auth'
import { withoutCloudflareAccessCookies } from '@/lib/cloudflare-access'

const handlers = toNextJsHandler(auth)

export async function GET(request: Request) {
  return handlers.GET(withoutCloudflareAccessCookies(request))
}

export async function POST(request: Request) {
  return handlers.POST(withoutCloudflareAccessCookies(request))
}

import { isAPIError } from 'better-auth/api'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { mobileEntryToken } from '@/lib/mobile-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = mobileEntryToken(request.url)

  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }

  try {
    const { headers } = await auth.api.verifyOneTimeToken({
      body: { token },
      headers: request.headers,
      returnHeaders: true,
    })

    const response = new Response(null, {
      status: 303,
      headers: { location: '/' },
    })

    for (const cookie of headers.getSetCookie()) {
      response.headers.append('set-cookie', cookie)
    }

    return response
  } catch (error) {
    if (isAPIError(error)) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }

    throw error
  }
}

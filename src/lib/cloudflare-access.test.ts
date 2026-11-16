import { describe, expect, it } from 'vitest'

import { withoutCloudflareAccessCookies } from '@/lib/cloudflare-access'

const url = 'https://leaf.example.com/api/auth/oauth2/token'

function post(cookie: string | null, body = 'grant_type=authorization_code') {
  const headers = new Headers({
    'content-type': 'application/x-www-form-urlencoded',
  })

  if (cookie !== null) {
    headers.set('cookie', cookie)
  }

  return new Request(url, { method: 'POST', headers, body })
}

describe('withoutCloudflareAccessCookies', () => {
  it('keeps a request without cookies as it is', () => {
    const request = post(null)

    expect(withoutCloudflareAccessCookies(request)).toBe(request)
  })

  it('keeps a request without Cloudflare Access cookies as it is', () => {
    const request = post('better-auth.session_token=abc; theme=dark')

    expect(withoutCloudflareAccessCookies(request)).toBe(request)
  })

  it('drops the cookie header when only Cloudflare Access sent cookies', () => {
    const stripped = withoutCloudflareAccessCookies(
      post('CF_Authorization=eyJ.jwt.sig'),
    )

    expect(stripped.headers.has('cookie')).toBe(false)
  })

  it('removes every Cloudflare Access cookie and keeps the others', () => {
    const stripped = withoutCloudflareAccessCookies(
      post(
        'CF_Authorization=a; better-auth.session_token=abc; CF_AppSession=b;CF_Binding=c; theme=dark',
      ),
    )

    expect(stripped.headers.get('cookie')).toBe(
      'better-auth.session_token=abc; theme=dark',
    )
  })

  it('keeps cookies whose names only look like the Cloudflare ones', () => {
    const request = post(
      'CF_Authorization2=a; XCF_Authorization=b; cf_authorization=c',
    )

    expect(withoutCloudflareAccessCookies(request)).toBe(request)
  })

  it('keeps the session cookie, so the origin check still runs for a signed-in person', () => {
    const stripped = withoutCloudflareAccessCookies(
      post('CF_Authorization=a; better-auth.session_token=abc'),
    )

    expect(stripped.headers.get('cookie')).toBe(
      'better-auth.session_token=abc',
    )
  })

  it('keeps a streamed body readable', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"client_name":"cli"}'))
        controller.close()
      },
    })
    const request = new Request(url, {
      method: 'POST',
      headers: { cookie: 'CF_Authorization=a' },
      body,
      duplex: 'half',
    } as RequestInit)

    const stripped = withoutCloudflareAccessCookies(request)

    expect(stripped.headers.has('cookie')).toBe(false)
    expect(await stripped.text()).toBe('{"client_name":"cli"}')
  })

  it('keeps the method, the url, the other headers and the body', async () => {
    const stripped = withoutCloudflareAccessCookies(
      post('CF_Authorization=a', 'grant_type=refresh_token&refresh_token=r'),
    )

    expect(stripped.method).toBe('POST')
    expect(stripped.url).toBe(url)
    expect(stripped.headers.get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    )
    expect(await stripped.text()).toBe(
      'grant_type=refresh_token&refresh_token=r',
    )
  })
})

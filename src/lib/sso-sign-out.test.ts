import { describe, expect, it } from 'vitest'

import { buildSsoSignOutUrl, requestOrigin } from '@/lib/sso-sign-out'

const issuer = 'https://auth.example.com/oidc'

describe('requestOrigin', () => {
  it('assumes https outside localhost', () => {
    expect(requestOrigin(new Headers({ host: 'leaf.example.com' }))).toBe(
      'https://leaf.example.com',
    )
  })

  it('assumes http on localhost', () => {
    expect(requestOrigin(new Headers({ host: 'localhost:3000' }))).toBe(
      'http://localhost:3000',
    )
  })

  it('prefers the proxy headers and uses only the first value', () => {
    const headers = new Headers({
      host: 'leaf-web.leaf.svc',
      'x-forwarded-host': 'leaf.example.com, internal',
      'x-forwarded-proto': 'https,http',
    })

    expect(requestOrigin(headers)).toBe('https://leaf.example.com')
  })

  it('returns null without a host', () => {
    expect(requestOrigin(new Headers())).toBeNull()
  })
})

describe('buildSsoSignOutUrl', () => {
  const logoutUrl = `${issuer}/auth/logout`

  it('goes back to the login after ending the session at the provider', () => {
    expect(buildSsoSignOutUrl(logoutUrl, 'https://leaf.example.com')).toBe(
      `${logoutUrl}?redirect=https%3A%2F%2Fleaf.example.com%2Flogin`,
    )
  })

  it('ends the session even without knowing the origin', () => {
    expect(buildSsoSignOutUrl(logoutUrl, null)).toBe(logoutUrl)
  })

  it('keeps the query the provider already asks for', () => {
    expect(
      buildSsoSignOutUrl(
        `${logoutUrl}?client_id=leaf`,
        'https://leaf.example.com',
      ),
    ).toBe(
      `${logoutUrl}?client_id=leaf&redirect=https%3A%2F%2Fleaf.example.com%2Flogin`,
    )
  })

  it('gives back what it got when the url is not a url', () => {
    expect(buildSsoSignOutUrl('not-a-url', 'https://leaf.example.com')).toBe(
      'not-a-url',
    )
  })
})

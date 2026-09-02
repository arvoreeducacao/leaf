import { describe, expect, it } from 'vitest'

import { buildSsoSignOutUrl, requestOrigin } from '@/lib/sso-sign-out'

const issuer = 'https://auth.arvore.com.br/api-arvore'

describe('requestOrigin', () => {
  it('assumes https outside localhost', () => {
    expect(requestOrigin(new Headers({ host: 'leaf.arvore.com.br' }))).toBe(
      'https://leaf.arvore.com.br',
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
      'x-forwarded-host': 'leaf.arvore.com.br, internal',
      'x-forwarded-proto': 'https,http',
    })

    expect(requestOrigin(headers)).toBe('https://leaf.arvore.com.br')
  })

  it('returns null without a host', () => {
    expect(requestOrigin(new Headers())).toBeNull()
  })
})

describe('buildSsoSignOutUrl', () => {
  it('goes back to the login after ending the session at the IdP', () => {
    expect(buildSsoSignOutUrl(issuer, 'https://leaf.arvore.com.br')).toBe(
      `${issuer}/auth/logout?redirect=https%3A%2F%2Fleaf.arvore.com.br%2Flogin`,
    )
  })

  it('ends the session even without knowing the origin', () => {
    expect(buildSsoSignOutUrl(issuer, null)).toBe(`${issuer}/auth/logout`)
  })

  it('does not duplicate the issuer slash', () => {
    expect(buildSsoSignOutUrl(`${issuer}/`, null)).toBe(
      `${issuer}/auth/logout`,
    )
  })
})

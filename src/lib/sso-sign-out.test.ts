import { describe, expect, it } from 'vitest'

import { buildSsoSignOutUrl, requestOrigin } from '@/lib/sso-sign-out'

const issuer = 'https://auth.arvore.com.br/api-arvore'

describe('requestOrigin', () => {
  it('assume https fora de localhost', () => {
    expect(requestOrigin(new Headers({ host: 'leaf.arvore.com.br' }))).toBe(
      'https://leaf.arvore.com.br',
    )
  })

  it('assume http em localhost', () => {
    expect(requestOrigin(new Headers({ host: 'localhost:3000' }))).toBe(
      'http://localhost:3000',
    )
  })

  it('prefere os cabeçalhos do proxy e usa só o primeiro valor', () => {
    const headers = new Headers({
      host: 'leaf-web.leaf.svc',
      'x-forwarded-host': 'leaf.arvore.com.br, interno',
      'x-forwarded-proto': 'https,http',
    })

    expect(requestOrigin(headers)).toBe('https://leaf.arvore.com.br')
  })

  it('devolve nulo sem host', () => {
    expect(requestOrigin(new Headers())).toBeNull()
  })
})

describe('buildSsoSignOutUrl', () => {
  it('volta para o login depois de encerrar a sessão no IdP', () => {
    expect(buildSsoSignOutUrl(issuer, 'https://leaf.arvore.com.br')).toBe(
      `${issuer}/auth/logout?redirect=https%3A%2F%2Fleaf.arvore.com.br%2Flogin`,
    )
  })

  it('encerra a sessão mesmo sem saber a origem', () => {
    expect(buildSsoSignOutUrl(issuer, null)).toBe(`${issuer}/auth/logout`)
  })

  it('não duplica a barra do issuer', () => {
    expect(buildSsoSignOutUrl(`${issuer}/`, null)).toBe(
      `${issuer}/auth/logout`,
    )
  })
})

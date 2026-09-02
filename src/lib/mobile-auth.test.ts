import { describe, expect, it } from 'vitest'

import {
  mobileAppScheme,
  mobileEntryToken,
  mobileTrustedOrigins,
} from '@/lib/mobile-auth'

describe('mobileTrustedOrigins', () => {
  it('trusts only the app scheme outside development', () => {
    expect(mobileTrustedOrigins('production')).toEqual([`${mobileAppScheme}://`])
    expect(mobileTrustedOrigins('test')).toEqual([`${mobileAppScheme}://`])
    expect(mobileTrustedOrigins(undefined)).toEqual([`${mobileAppScheme}://`])
  })

  it('also trusts the Expo dev client scheme in development', () => {
    expect(mobileTrustedOrigins('development')).toEqual([
      `${mobileAppScheme}://`,
      'exp://',
      'exp://**',
    ])
  })

  it('never trusts an http origin', () => {
    for (const env of ['development', 'production']) {
      expect(
        mobileTrustedOrigins(env).some((origin) => origin.startsWith('http')),
      ).toBe(false)
    }
  })
})

describe('mobileEntryToken', () => {
  it('reads the token from the query string', () => {
    expect(
      mobileEntryToken('https://leaf.arvore.com.br/api/mobile/enter?token=abc123'),
    ).toBe('abc123')
  })

  it('rejects a missing or blank token', () => {
    expect(mobileEntryToken('https://leaf.arvore.com.br/api/mobile/enter')).toBeNull()
    expect(
      mobileEntryToken('https://leaf.arvore.com.br/api/mobile/enter?token=%20'),
    ).toBeNull()
  })
})

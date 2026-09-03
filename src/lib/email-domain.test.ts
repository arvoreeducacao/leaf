import { describe, expect, it } from 'vitest'

import {
  emailDomainPolicy,
  isEmailDomainAllowed,
  parseAllowedDomains,
} from '@/lib/email-domain'

describe('parseAllowedDomains', () => {
  it('returns an empty list when there is no value', () => {
    expect(parseAllowedDomains(undefined)).toEqual([])
    expect(parseAllowedDomains(null)).toEqual([])
    expect(parseAllowedDomains('')).toEqual([])
    expect(parseAllowedDomains('  ,  ,')).toEqual([])
  })

  it('normalizes whitespace, case and the at sign', () => {
    expect(parseAllowedDomains(' @Arvore.COM.BR , other.com ')).toEqual([
      'arvore.com.br',
      'other.com',
    ])
  })

  it('drops repeated domains', () => {
    expect(parseAllowedDomains('arvore.com.br,ARVORE.com.br')).toEqual([
      'arvore.com.br',
    ])
  })
})

describe('emailDomainPolicy', () => {
  it('stays inactive without the environment variable', () => {
    expect(emailDomainPolicy(undefined)).toEqual({
      active: false,
      domains: [],
      primaryDomain: null,
    })
  })

  it('exposes the primary domain when active', () => {
    expect(emailDomainPolicy('arvore.com.br,arvore.dev')).toEqual({
      active: true,
      domains: ['arvore.com.br', 'arvore.dev'],
      primaryDomain: 'arvore.com.br',
    })
  })

  it('reads the environment variable at call time', () => {
    const previous = process.env.LEAF_ALLOWED_EMAIL_DOMAINS

    process.env.LEAF_ALLOWED_EMAIL_DOMAINS = 'arvore.com.br'
    expect(emailDomainPolicy().primaryDomain).toBe('arvore.com.br')

    delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
    expect(emailDomainPolicy().active).toBe(false)

    if (previous !== undefined) {
      process.env.LEAF_ALLOWED_EMAIL_DOMAINS = previous
    }
  })
})

describe('isEmailDomainAllowed', () => {
  const single = ['arvore.com.br']
  const multi = ['arvore.com.br', 'arvore.dev']

  it('allows everything when no domain is configured', () => {
    expect(isEmailDomainAllowed('anyone@gmail.com', [])).toBe(true)
    expect(isEmailDomainAllowed('', [])).toBe(true)
  })

  it('accepts an email from the allowed domain', () => {
    expect(isEmailDomainAllowed('person@arvore.com.br', single)).toBe(true)
  })

  it('rejects an email outside the domain', () => {
    expect(isEmailDomainAllowed('person@gmail.com', single)).toBe(false)
    expect(isEmailDomainAllowed('person@otherschool.com.br', single)).toBe(
      false,
    )
  })

  it('ignores case and whitespace', () => {
    expect(isEmailDomainAllowed('  Person@ARVORE.com.BR  ', single)).toBe(true)
  })

  it('accepts any domain from the list', () => {
    expect(isEmailDomainAllowed('person@arvore.dev', multi)).toBe(true)
    expect(isEmailDomainAllowed('person@arvore.com.br', multi)).toBe(true)
    expect(isEmailDomainAllowed('person@arvore.com', multi)).toBe(false)
  })

  it('does not accept a subdomain of the allowed domain', () => {
    expect(isEmailDomainAllowed('person@mail.arvore.com.br', single)).toBe(
      false,
    )
  })

  it('is not fooled by an extra at sign', () => {
    expect(isEmailDomainAllowed('person@arvore.com.br@gmail.com', single)).toBe(
      false,
    )
    expect(isEmailDomainAllowed('person@gmail.com@arvore.com.br', single)).toBe(
      true,
    )
  })

  it('rejects malformed input', () => {
    expect(isEmailDomainAllowed('noatsign', single)).toBe(false)
    expect(isEmailDomainAllowed('@arvore.com.br', single)).toBe(false)
    expect(isEmailDomainAllowed('person@', single)).toBe(false)
    expect(isEmailDomainAllowed(undefined, single)).toBe(false)
    expect(isEmailDomainAllowed(null, single)).toBe(false)
  })
})

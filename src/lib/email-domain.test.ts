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
    expect(parseAllowedDomains(' @Example.COM , other.com ')).toEqual([
      'example.com',
      'other.com',
    ])
  })

  it('drops repeated domains', () => {
    expect(parseAllowedDomains('example.com,EXAMPLE.com')).toEqual([
      'example.com',
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
    expect(emailDomainPolicy('example.com,example.dev')).toEqual({
      active: true,
      domains: ['example.com', 'example.dev'],
      primaryDomain: 'example.com',
    })
  })

  it('reads the environment variable at call time', () => {
    const previous = process.env.LEAF_ALLOWED_EMAIL_DOMAINS

    process.env.LEAF_ALLOWED_EMAIL_DOMAINS = 'example.com'
    expect(emailDomainPolicy().primaryDomain).toBe('example.com')

    delete process.env.LEAF_ALLOWED_EMAIL_DOMAINS
    expect(emailDomainPolicy().active).toBe(false)

    if (previous !== undefined) {
      process.env.LEAF_ALLOWED_EMAIL_DOMAINS = previous
    }
  })
})

describe('isEmailDomainAllowed', () => {
  const single = ['example.com']
  const multi = ['example.com', 'example.dev']

  it('allows everything when no domain is configured', () => {
    expect(isEmailDomainAllowed('anyone@gmail.com', [])).toBe(true)
    expect(isEmailDomainAllowed('', [])).toBe(true)
  })

  it('accepts an email from the allowed domain', () => {
    expect(isEmailDomainAllowed('person@example.com', single)).toBe(true)
  })

  it('rejects an email outside the domain', () => {
    expect(isEmailDomainAllowed('person@gmail.com', single)).toBe(false)
    expect(isEmailDomainAllowed('person@otherschool.com.br', single)).toBe(
      false,
    )
  })

  it('ignores case and whitespace', () => {
    expect(isEmailDomainAllowed('  Person@EXAMPLE.com  ', single)).toBe(true)
  })

  it('accepts any domain from the list', () => {
    expect(isEmailDomainAllowed('person@example.dev', multi)).toBe(true)
    expect(isEmailDomainAllowed('person@example.com', multi)).toBe(true)
    expect(isEmailDomainAllowed('person@other.com', multi)).toBe(false)
  })

  it('does not accept a subdomain of the allowed domain', () => {
    expect(isEmailDomainAllowed('person@mail.example.com', single)).toBe(
      false,
    )
  })

  it('is not fooled by an extra at sign', () => {
    expect(isEmailDomainAllowed('person@example.com@gmail.com', single)).toBe(
      false,
    )
    expect(isEmailDomainAllowed('person@gmail.com@example.com', single)).toBe(
      true,
    )
  })

  it('rejects malformed input', () => {
    expect(isEmailDomainAllowed('noatsign', single)).toBe(false)
    expect(isEmailDomainAllowed('@example.com', single)).toBe(false)
    expect(isEmailDomainAllowed('person@', single)).toBe(false)
    expect(isEmailDomainAllowed(undefined, single)).toBe(false)
    expect(isEmailDomainAllowed(null, single)).toBe(false)
  })
})

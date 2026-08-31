import { describe, expect, it } from 'vitest'

import {
  emailDomainPolicy,
  isEmailDomainAllowed,
  parseAllowedDomains,
} from '@/lib/email-domain'

describe('parseAllowedDomains', () => {
  it('devolve lista vazia sem valor', () => {
    expect(parseAllowedDomains(undefined)).toEqual([])
    expect(parseAllowedDomains(null)).toEqual([])
    expect(parseAllowedDomains('')).toEqual([])
    expect(parseAllowedDomains('  ,  ,')).toEqual([])
  })

  it('normaliza espaços, caixa e arroba', () => {
    expect(parseAllowedDomains(' @Arvore.COM.BR , outra.com ')).toEqual([
      'arvore.com.br',
      'outra.com',
    ])
  })

  it('remove domínios repetidos', () => {
    expect(parseAllowedDomains('arvore.com.br,ARVORE.com.br')).toEqual([
      'arvore.com.br',
    ])
  })
})

describe('emailDomainPolicy', () => {
  it('fica inativa sem a variável de ambiente', () => {
    expect(emailDomainPolicy(undefined)).toEqual({
      active: false,
      domains: [],
      primaryDomain: null,
    })
  })

  it('expõe o domínio principal quando ativa', () => {
    expect(emailDomainPolicy('arvore.com.br,arvore.dev')).toEqual({
      active: true,
      domains: ['arvore.com.br', 'arvore.dev'],
      primaryDomain: 'arvore.com.br',
    })
  })

  it('lê a variável de ambiente em tempo de chamada', () => {
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

  it('libera tudo quando não há domínios configurados', () => {
    expect(isEmailDomainAllowed('qualquer@gmail.com', [])).toBe(true)
    expect(isEmailDomainAllowed('', [])).toBe(true)
  })

  it('aceita email do domínio permitido', () => {
    expect(isEmailDomainAllowed('pessoa@arvore.com.br', single)).toBe(true)
  })

  it('nega email de fora do domínio', () => {
    expect(isEmailDomainAllowed('pessoa@gmail.com', single)).toBe(false)
    expect(isEmailDomainAllowed('pessoa@outraescola.com.br', single)).toBe(
      false,
    )
  })

  it('ignora caixa e espaços', () => {
    expect(isEmailDomainAllowed('  Pessoa@ARVORE.com.BR  ', single)).toBe(true)
  })

  it('aceita qualquer domínio da lista', () => {
    expect(isEmailDomainAllowed('pessoa@arvore.dev', multi)).toBe(true)
    expect(isEmailDomainAllowed('pessoa@arvore.com.br', multi)).toBe(true)
    expect(isEmailDomainAllowed('pessoa@arvore.com', multi)).toBe(false)
  })

  it('não aceita subdomínio do domínio permitido', () => {
    expect(isEmailDomainAllowed('pessoa@mail.arvore.com.br', single)).toBe(
      false,
    )
  })

  it('não se deixa enganar por arroba extra', () => {
    expect(isEmailDomainAllowed('pessoa@arvore.com.br@gmail.com', single)).toBe(
      false,
    )
    expect(isEmailDomainAllowed('pessoa@gmail.com@arvore.com.br', single)).toBe(
      true,
    )
  })

  it('nega entradas malformadas', () => {
    expect(isEmailDomainAllowed('semarroba', single)).toBe(false)
    expect(isEmailDomainAllowed('@arvore.com.br', single)).toBe(false)
    expect(isEmailDomainAllowed('pessoa@', single)).toBe(false)
    expect(isEmailDomainAllowed(undefined, single)).toBe(false)
    expect(isEmailDomainAllowed(null, single)).toBe(false)
  })
})

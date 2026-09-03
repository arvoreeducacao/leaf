import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  authIssuer,
  isMcpEnabled,
  isMcpWriteEnabled,
  mcpAllowedHosts,
  mcpResourceUrl,
  protectedResourceMetadataUrl,
} from '@/lib/mcp-config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('flags do MCP', () => {
  it('fica ligado por padrão fora de produção e desligado em produção', () => {
    vi.stubEnv('LEAF_MCP_ENABLED', undefined)
    vi.stubEnv('NODE_ENV', 'development')
    expect(isMcpEnabled()).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    expect(isMcpEnabled()).toBe(false)

    vi.stubEnv('LEAF_MCP_ENABLED', 'true')
    expect(isMcpEnabled()).toBe(true)

    vi.stubEnv('LEAF_MCP_ENABLED', 'off')
    expect(isMcpEnabled()).toBe(false)
  })

  it('a escrita depende do MCP ligado e de LEAF_MCP_WRITE', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LEAF_MCP_ENABLED', '1')
    vi.stubEnv('LEAF_MCP_WRITE', undefined)
    expect(isMcpWriteEnabled()).toBe(true)

    vi.stubEnv('LEAF_MCP_WRITE', '0')
    expect(isMcpWriteEnabled()).toBe(false)

    vi.stubEnv('LEAF_MCP_WRITE', '1')
    vi.stubEnv('LEAF_MCP_ENABLED', '0')
    expect(isMcpWriteEnabled()).toBe(false)
  })
})

describe('issuer e resource', () => {
  it('deriva tudo de BETTER_AUTH_URL sem barra final', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://leaf.exemplo.org/')

    expect(authIssuer()).toBe('https://leaf.exemplo.org')
    expect(mcpResourceUrl()).toBe('https://leaf.exemplo.org/api/mcp')
    expect(protectedResourceMetadataUrl()).toBe(
      'https://leaf.exemplo.org/.well-known/oauth-protected-resource/api/mcp',
    )
  })

  it('só aceita o host do issuer em produção', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://leaf.exemplo.org')
    vi.stubEnv('NODE_ENV', 'production')

    expect(mcpAllowedHosts()).toEqual(['leaf.exemplo.org'])
  })
})

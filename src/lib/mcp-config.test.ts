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
  it('is on by default outside production and off in production', () => {
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

  it('writing depends on MCP being on and on LEAF_MCP_WRITE', () => {
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
  it('derives everything from BETTER_AUTH_URL without a trailing slash', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://leaf.exemplo.org/')

    expect(authIssuer()).toBe('https://leaf.exemplo.org')
    expect(mcpResourceUrl()).toBe('https://leaf.exemplo.org/api/mcp')
    expect(protectedResourceMetadataUrl()).toBe(
      'https://leaf.exemplo.org/.well-known/oauth-protected-resource/api/mcp',
    )
  })

  it('accepts only the issuer host in production', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://leaf.exemplo.org')
    vi.stubEnv('NODE_ENV', 'production')

    expect(mcpAllowedHosts()).toEqual(['leaf.exemplo.org'])
  })
})

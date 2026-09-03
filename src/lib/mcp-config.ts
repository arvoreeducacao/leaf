export const mcpScopes = ['leaf:read', 'leaf:write', 'offline_access'] as const

export type McpScope = (typeof mcpScopes)[number]

export const mcpReadScope: McpScope = 'leaf:read'
export const mcpWriteScope: McpScope = 'leaf:write'

export const mcpAccessTokenTtlSeconds = 15 * 60

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function flagValue(value: string | undefined, fallback: boolean) {
  const flag = normalize(value)

  if (flag.length === 0) {
    return fallback
  }

  return flag === '1' || flag === 'true' || flag === 'on'
}

export function isMcpEnabled() {
  return flagValue(
    process.env.LEAF_MCP_ENABLED,
    process.env.NODE_ENV !== 'production',
  )
}

export function isMcpWriteEnabled() {
  return isMcpEnabled() && flagValue(process.env.LEAF_MCP_WRITE, true)
}

export function authIssuer() {
  const configured = process.env.BETTER_AUTH_URL?.trim()

  return (configured && configured.length > 0
    ? configured
    : 'http://localhost:3000'
  ).replace(/\/+$/, '')
}

export function authBasePath() {
  return '/api/auth'
}

export function mcpPath() {
  return '/api/mcp'
}

export function mcpResourceUrl() {
  return `${authIssuer()}${mcpPath()}`
}

export function protectedResourceMetadataUrl() {
  return `${authIssuer()}/.well-known/oauth-protected-resource${mcpPath()}`
}

export function jwksUrl() {
  return `${authIssuer()}${authBasePath()}/jwks`
}

export function mcpAllowedHosts() {
  const issuerHost = new URL(authIssuer()).host
  const hosts = new Set([issuerHost])

  if (process.env.NODE_ENV !== 'production') {
    const port = new URL(authIssuer()).port
    const suffix = port.length > 0 ? `:${port}` : ''

    hosts.add(`localhost${suffix}`)
    hosts.add(`127.0.0.1${suffix}`)
  }

  return [...hosts]
}

import { auth } from '@/lib/auth'
import {
  authIssuer,
  isMcpEnabled,
  mcpResourceUrl,
  mcpScopes,
} from '@/lib/mcp-config'

const noStore = { 'Cache-Control': 'no-store' }

export function mcpNotFound() {
  return Response.json({ error: 'not-found' }, { status: 404, headers: noStore })
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [authIssuer()],
    scopes_supported: [...mcpScopes],
    bearer_methods_supported: ['header'],
    resource_name: 'Leaf MCP',
    resource_documentation: `${authIssuer()}/connected-apps`,
  }
}

export function protectedResourceMetadataResponse() {
  if (!isMcpEnabled()) {
    return mcpNotFound()
  }

  return Response.json(protectedResourceMetadata(), {
    headers: { ...noStore, 'Access-Control-Allow-Origin': '*' },
  })
}

export async function authorizationServerMetadataResponse(request: Request) {
  if (!isMcpEnabled()) {
    return mcpNotFound()
  }

  const response = await auth.handler(
    new Request(request.url, { method: 'GET', headers: request.headers }),
  )

  if (response.status !== 200) {
    return mcpNotFound()
  }

  const metadata = (await response.json()) as Record<string, unknown>

  return Response.json(
    { ...metadata, token_endpoint_auth_methods_supported: ['none'] },
    { headers: { ...noStore, 'Access-Control-Allow-Origin': '*' } },
  )
}

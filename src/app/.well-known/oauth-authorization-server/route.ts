import { authorizationServerMetadataResponse } from '@/lib/mcp/discovery'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return authorizationServerMetadataResponse(request)
}

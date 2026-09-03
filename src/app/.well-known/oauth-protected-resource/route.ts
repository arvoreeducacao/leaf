import { protectedResourceMetadataResponse } from '@/lib/mcp/discovery'

export const dynamic = 'force-dynamic'

export async function GET() {
  return protectedResourceMetadataResponse()
}

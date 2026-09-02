import { AIExtension } from '@blocknote/xl-ai'
import { DefaultChatTransport } from 'ai'

import { realtimeCursorColors } from '@/lib/realtime-user'

export const aiEndpoint = '/api/ai'

const agentCursorColor = realtimeCursorColors.light[2]

export function createLeafAiExtension(documentId: string, agentName: string) {
  return AIExtension({
    transport: new DefaultChatTransport({
      api: aiEndpoint,
      body: { documentId },
    }),
    agentCursor: { name: agentName, color: agentCursorColor },
  })
}

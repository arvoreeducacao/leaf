import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents } from '@/db/schema'
import {
  realtimeSecretHeader,
  type RealtimeSignalTopic,
} from '@/lib/realtime'
import {
  isRealtimeEnabled,
  realtimeSecret,
  realtimeServerUrl,
} from '@/lib/realtime-config'

const signalTimeoutMs = 1_500

export async function signalOpenTabs(
  documentIds: ReadonlyArray<string>,
  topic: RealtimeSignalTopic,
) {
  const secret = realtimeSecret()

  if (!isRealtimeEnabled() || !secret || documentIds.length === 0) {
    return
  }

  try {
    const response = await fetch(`${realtimeServerUrl()}/signals`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [realtimeSecretHeader]: secret,
      },
      body: JSON.stringify({ documentIds, topic }),
      signal: AbortSignal.timeout(signalTimeoutMs),
    })

    if (!response.ok) {
      console.error(
        `[leaf] the collaboration server refused a change for open tabs (${response.status}). They see it on the next reload.`,
      )
    }
  } catch {
    console.error(
      '[leaf] the collaboration server did not answer a change for open tabs. They see it on the next reload.',
    )
  }
}

export async function signalDocumentChanged(documentId: string) {
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    columns: { kind: true, parentId: true },
  })

  await signalOpenTabs([documentId], 'document')

  if (document?.kind === 'database') {
    await signalOpenTabs([documentId], 'database')
  }

  if (document?.kind === 'row' && document.parentId) {
    await signalOpenTabs([document.parentId], 'database')
  }
}

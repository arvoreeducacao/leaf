'use client'

import { isLive } from '@/lib/offline/live-documents'
import { updateDocumentContent } from '@/lib/document-actions'

import { flushOutbox } from './outbox'
import type { FlushReport, OutboxEntry, OutboxSendResult } from './outbox'
import { offlineStore } from './store'

async function sendEntry(entry: OutboxEntry): Promise<OutboxSendResult> {
  try {
    const result = await updateDocumentContent(entry.documentId, entry.content)

    return result.ok ? { status: 'sent' } : { status: 'drop' }
  } catch {
    return { status: 'retry' }
  }
}

let running: Promise<FlushReport> | null = null

export function syncPendingDocuments(): Promise<FlushReport> {
  if (running) {
    return running
  }

  running = flushOutbox(offlineStore(), sendEntry, isLive).finally(() => {
    running = null
  })

  return running
}

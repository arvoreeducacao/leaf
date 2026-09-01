import type { OfflineStore } from './store'

export const outboxPrefix = 'outbox:'

export type OutboxEntry = Readonly<{
  documentId: string
  content: string
  queuedAt: number
}>

export type OutboxSendResult =
  | Readonly<{ status: 'sent' }>
  | Readonly<{ status: 'retry' }>
  | Readonly<{ status: 'drop' }>

export type FlushReport = Readonly<{
  sent: Array<string>
  retry: Array<string>
  dropped: Array<string>
}>

export function outboxKey(documentId: string) {
  return `${outboxPrefix}${documentId}`
}

export async function queueDocumentContent(
  store: OfflineStore,
  documentId: string,
  content: string,
  queuedAt: number,
) {
  await store.set(outboxKey(documentId), { documentId, content, queuedAt })
}

export async function dropQueuedDocument(
  store: OfflineStore,
  documentId: string,
) {
  await store.remove(outboxKey(documentId))
}

export async function readQueuedDocument(
  store: OfflineStore,
  documentId: string,
) {
  return store.get<OutboxEntry>(outboxKey(documentId))
}

export async function readOutbox(
  store: OfflineStore,
): Promise<Array<OutboxEntry>> {
  const keys = await store.keys()
  const entries: Array<OutboxEntry> = []

  for (const key of keys) {
    if (!key.startsWith(outboxPrefix)) {
      continue
    }

    const entry = await store.get<OutboxEntry>(key)

    if (entry && typeof entry.content === 'string') {
      entries.push(entry)
    }
  }

  return entries.sort((left, right) => left.queuedAt - right.queuedAt)
}

export async function flushOutbox(
  store: OfflineStore,
  send: (entry: OutboxEntry) => Promise<OutboxSendResult>,
  isHandledElsewhere: (documentId: string) => boolean = () => false,
): Promise<FlushReport> {
  const report: { sent: Array<string>; retry: Array<string>; dropped: Array<string> } =
    { sent: [], retry: [], dropped: [] }

  for (const entry of await readOutbox(store)) {
    if (isHandledElsewhere(entry.documentId)) {
      await dropQueuedDocument(store, entry.documentId)
      report.dropped.push(entry.documentId)

      continue
    }

    const result = await send(entry)

    if (result.status === 'retry') {
      report.retry.push(entry.documentId)

      continue
    }

    const current = await readQueuedDocument(store, entry.documentId)

    if (current === null || current.queuedAt === entry.queuedAt) {
      await dropQueuedDocument(store, entry.documentId)
    }

    if (result.status === 'sent') {
      report.sent.push(entry.documentId)
    } else {
      report.dropped.push(entry.documentId)
    }
  }

  return report
}

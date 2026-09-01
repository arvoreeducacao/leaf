import { describe, expect, it } from 'vitest'

import {
  dropQueuedDocument,
  flushOutbox,
  outboxKey,
  queueDocumentContent,
  readOutbox,
  readQueuedDocument,
} from './outbox'
import type { OutboxEntry, OutboxSendResult } from './outbox'
import { createMemoryStore } from './store'

function alwaysSend(status: OutboxSendResult['status']) {
  return async (): Promise<OutboxSendResult> => ({ status })
}

describe('outbox', () => {
  it('keeps only the latest content per document', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'first', 1)
    await queueDocumentContent(store, 'doc-1', 'second', 2)

    const entries = await readOutbox(store)

    expect(entries).toEqual([
      { documentId: 'doc-1', content: 'second', queuedAt: 2 },
    ])
  })

  it('reads entries oldest first and ignores keys it does not own', async () => {
    const store = createMemoryStore({ 'doc:doc-9': { identity: null } })

    await queueDocumentContent(store, 'doc-b', 'b', 20)
    await queueDocumentContent(store, 'doc-a', 'a', 10)

    expect((await readOutbox(store)).map((entry) => entry.documentId)).toEqual([
      'doc-a',
      'doc-b',
    ])
  })

  it('clears an entry once it reaches the server', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'body', 1)

    const report = await flushOutbox(store, alwaysSend('sent'))

    expect(report.sent).toEqual(['doc-1'])
    expect(await readOutbox(store)).toEqual([])
  })

  it('keeps an entry when the send has to be retried', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'body', 1)

    const report = await flushOutbox(store, alwaysSend('retry'))

    expect(report.retry).toEqual(['doc-1'])
    expect(await readQueuedDocument(store, 'doc-1')).not.toBeNull()
  })

  it('keeps edits that arrive while the entry is in flight', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'first', 1)

    const send = async (entry: OutboxEntry): Promise<OutboxSendResult> => {
      await queueDocumentContent(store, entry.documentId, 'newer', 2)

      return { status: 'sent' }
    }

    await flushOutbox(store, send)

    expect(await readQueuedDocument(store, 'doc-1')).toMatchObject({
      content: 'newer',
      queuedAt: 2,
    })
  })

  it('drops entries a live collaboration session already owns', async () => {
    const store = createMemoryStore()
    const sent: Array<string> = []

    await queueDocumentContent(store, 'doc-live', 'body', 1)
    await queueDocumentContent(store, 'doc-solo', 'body', 2)

    const report = await flushOutbox(
      store,
      async (entry) => {
        sent.push(entry.documentId)

        return { status: 'sent' }
      },
      (documentId) => documentId === 'doc-live',
    )

    expect(sent).toEqual(['doc-solo'])
    expect(report.dropped).toEqual(['doc-live'])
    expect(await readOutbox(store)).toEqual([])
  })

  it('drops an entry the server refused for good', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'body', 1)

    const report = await flushOutbox(store, alwaysSend('drop'))

    expect(report.dropped).toEqual(['doc-1'])
    expect(await readOutbox(store)).toEqual([])
  })

  it('removes a queued document on demand', async () => {
    const store = createMemoryStore()

    await queueDocumentContent(store, 'doc-1', 'body', 1)
    await dropQueuedDocument(store, 'doc-1')

    expect(await store.get(outboxKey('doc-1'))).toBeNull()
  })
})

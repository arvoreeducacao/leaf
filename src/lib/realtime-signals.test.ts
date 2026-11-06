import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findDocument = vi.hoisted(() => vi.fn())

vi.mock('@/db', () => ({
  db: { query: { documents: { findFirst: findDocument } } },
}))

import { realtimeSecretHeader } from './realtime'
import { signalDocumentChanged, signalOpenTabs } from './realtime-signals'

type Call = Readonly<{ url: string; headers: Headers; body: unknown }>

let calls: Array<Call> = []

beforeEach(() => {
  calls = []
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('LEAF_REALTIME', 'on')
  vi.stubEnv('LEAF_REALTIME_SECRET', 'segredo')
  vi.stubEnv('LEAF_REALTIME_SERVER_URL', 'http://realtime.test/')
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: new Headers(init.headers),
      body: JSON.parse(String(init.body)),
    })

    return Response.json({ status: 'ok', delivered: 1 })
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  findDocument.mockReset()
})

describe('signalOpenTabs', () => {
  it('asks the collaboration server to tell the open tabs, with the secret', async () => {
    await signalOpenTabs(['doc-1', 'doc-2'], 'comments')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://realtime.test/signals')
    expect(calls[0].headers.get(realtimeSecretHeader)).toBe('segredo')
    expect(calls[0].body).toEqual({
      documentIds: ['doc-1', 'doc-2'],
      topic: 'comments',
    })
  })

  it('stays quiet when collaboration is off or there is nothing to tell', async () => {
    await signalOpenTabs([], 'document')

    vi.stubEnv('LEAF_REALTIME', 'false')

    await signalOpenTabs(['doc-1'], 'document')

    expect(calls).toHaveLength(0)
  })

  it('does not fail the change when the server does not answer', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.stubGlobal('fetch', async () => {
      throw new Error('connection refused')
    })

    await expect(signalOpenTabs(['doc-1'], 'document')).resolves.toBeUndefined()
    expect(logged).toHaveBeenCalledOnce()
  })
})

describe('signalDocumentChanged', () => {
  it('tells the database a row belongs to', async () => {
    findDocument.mockResolvedValue({ kind: 'row', parentId: 'base-1' })

    await signalDocumentChanged('row-1')

    expect(calls.map((call) => call.body)).toEqual([
      { documentIds: ['row-1'], topic: 'document' },
      { documentIds: ['base-1'], topic: 'database' },
    ])
  })

  it('tells the table itself when the document is a database', async () => {
    findDocument.mockResolvedValue({ kind: 'database', parentId: null })

    await signalDocumentChanged('base-1')

    expect(calls.map((call) => call.body)).toEqual([
      { documentIds: ['base-1'], topic: 'document' },
      { documentIds: ['base-1'], topic: 'database' },
    ])
  })

  it('tells only the page when it is a plain page', async () => {
    findDocument.mockResolvedValue({ kind: 'page', parentId: 'parent-1' })

    await signalDocumentChanged('page-1')

    expect(calls.map((call) => call.body)).toEqual([
      { documentIds: ['page-1'], topic: 'document' },
    ])
  })
})

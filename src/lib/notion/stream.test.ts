import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImportEvent } from '@/lib/notion/import'
import { importEventStream } from '@/lib/notion/stream'

const decoder = new TextDecoder()

function chunksOf(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Array<string> = []
  let closed = false

  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read()

      if (done) {
        closed = true

        return
      }

      chunks.push(decoder.decode(value))
    }
  })()

  return { chunks, isClosed: () => closed, pump }
}

describe('import event stream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends a blank line while the import has nothing to report', async () => {
    let release = () => {}
    const silence = new Promise<void>((resolve) => {
      release = resolve
    })

    async function* events(): AsyncGenerator<ImportEvent> {
      await silence
      yield {
        done: 1,
        label: 'Tecnologia',
        phase: 'reading',
        total: 0,
        type: 'progress',
      }
    }

    const stream = importEventStream(events(), {
      failure: 'unfinished',
      keepAliveMs: 1000,
    })
    const { chunks, isClosed, pump } = chunksOf(stream)

    await vi.advanceTimersByTimeAsync(3500)

    expect(chunks).toEqual(['\n', '\n', '\n'])

    release()
    await vi.advanceTimersByTimeAsync(0)
    await pump

    expect(chunks.at(-1)).toContain('"label":"Tecnologia"')
    expect(isClosed()).toBe(true)
  })

  it('stops the blank lines once the import ends', async () => {
    async function* events(): AsyncGenerator<ImportEvent> {
      yield {
        summary: {
          assets: 0,
          pages: 1,
          rootId: null,
          rootTitle: null,
          warnings: [],
        },
        type: 'done',
      }
    }

    const onDone = vi.fn()
    const stream = importEventStream(events(), {
      failure: 'unfinished',
      keepAliveMs: 1000,
      onDone,
    })
    const { chunks, pump } = chunksOf(stream)

    await pump
    await vi.advanceTimersByTimeAsync(5000)

    expect(chunks).toHaveLength(1)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('reports a failure as the last event', async () => {
    async function* events(): AsyncGenerator<ImportEvent> {
      yield {
        done: 1,
        label: 'CX',
        phase: 'reading',
        total: 0,
        type: 'progress',
      }
      throw new Error('notion is down')
    }

    const stream = importEventStream(events(), { failure: 'unfinished' })
    const { chunks, pump } = chunksOf(stream)

    await pump

    expect(JSON.parse(chunks[1])).toEqual({
      error: 'unfinished',
      type: 'error',
    })
  })
})

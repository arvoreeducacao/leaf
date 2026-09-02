import { describe, expect, it, vi } from 'vitest'

import { NotionApiError, createNotionClient } from '@/lib/notion/api'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { headers, status })
}

describe('createNotionClient retries', () => {
  it('retries a 429 with backoff and then succeeds', async () => {
    vi.useFakeTimers()

    const calls: Array<string> = []
    const client = createNotionClient('token', {
      fetch: async (input) => {
        calls.push(String(input))

        return calls.length === 1
          ? jsonResponse(429, {}, { 'retry-after': '0.01' })
          : jsonResponse(200, { id: 'page-1' })
      },
    })

    const promise = client.page('page-1')

    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual({ id: 'page-1' })
    expect(calls).toHaveLength(2)

    vi.useRealTimers()
  })

  it('does not retry a 404', async () => {
    const calls: Array<string> = []
    const client = createNotionClient('token', {
      fetch: async (input) => {
        calls.push(String(input))

        return jsonResponse(404, {})
      },
    })

    await expect(client.page('missing')).rejects.toBeInstanceOf(NotionApiError)
    expect(calls).toHaveLength(1)
  })

  it('gives up after too many retryable failures', async () => {
    vi.useFakeTimers()

    const calls: Array<string> = []
    const client = createNotionClient('token', {
      fetch: async (input) => {
        calls.push(String(input))

        return jsonResponse(503, {}, { 'retry-after': '0.01' })
      },
    })

    const promise = client.page('page-1')
    const outcome = promise.catch((error: unknown) => error)

    await vi.runAllTimersAsync()

    expect(await outcome).toBeInstanceOf(NotionApiError)
    expect(calls).toHaveLength(5)

    vi.useRealTimers()
  })
})

import { describe, expect, it, vi } from 'vitest'

import type { GithubPullRequest } from '@/lib/github/api'
import { GithubApiError, createGithubClient, pullState } from '@/lib/github/api'

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), { headers, status })
}

function pull(number: number): GithubPullRequest {
  return {
    id: number,
    number,
    title: `PR ${number}`,
    updated_at: '2026-09-01T00:00:00Z',
  }
}

async function collect(
  generator: AsyncGenerator<GithubPullRequest>,
): Promise<Array<GithubPullRequest>> {
  const items: Array<GithubPullRequest> = []

  for await (const item of generator) {
    items.push(item)
  }

  return items
}

describe('pullState', () => {
  it('reads merged from merged_at, not from state', () => {
    expect(
      pullState({ id: 1, merged_at: '2026-09-01T00:00:00Z', number: 1, state: 'closed' }),
    ).toBe('merged')
  })

  it('separates closed from open', () => {
    expect(pullState({ id: 1, number: 1, state: 'closed' })).toBe('closed')
    expect(pullState({ id: 1, number: 1, state: 'open' })).toBe('open')
  })
})

describe('createGithubClient pagination', () => {
  it('walks pages until a short one arrives', async () => {
    const urls: Array<string> = []
    const client = createGithubClient('token', {
      fetch: async (input) => {
        urls.push(String(input))

        const page = Number(new URL(String(input)).searchParams.get('page'))

        return jsonResponse(
          200,
          page === 1
            ? Array.from({ length: 100 }, (_, index) => pull(index + 1))
            : [pull(101)],
        )
      },
    })

    const pulls = await collect(client.pulls('org/repo'))

    expect(pulls).toHaveLength(101)
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('/repos/org/repo/pulls?')
    expect(urls[0]).toContain('sort=updated')
    expect(urls[0]).toContain('state=all')
  })

  it('stops on an empty page', async () => {
    let calls = 0
    const client = createGithubClient('token', {
      fetch: async () => {
        calls += 1

        return jsonResponse(200, [])
      },
    })

    await expect(collect(client.pulls('org/repo'))).resolves.toEqual([])
    expect(calls).toBe(1)
  })
})

describe('createGithubClient retries', () => {
  it('waits out a rate limit and then succeeds', async () => {
    vi.useFakeTimers()

    let calls = 0
    const client = createGithubClient('token', {
      fetch: async () => {
        calls += 1

        return calls === 1
          ? jsonResponse(403, {}, { 'retry-after': '0.01' })
          : jsonResponse(200, [pull(1)])
      },
    })

    const promise = collect(client.pulls('org/repo'))

    await vi.runAllTimersAsync()

    await expect(promise).resolves.toHaveLength(1)
    expect(calls).toBe(2)

    vi.useRealTimers()
  })

  it('does not retry a 404', async () => {
    let calls = 0
    const client = createGithubClient('token', {
      fetch: async () => {
        calls += 1

        return jsonResponse(404, {})
      },
    })

    await expect(collect(client.pulls('org/gone'))).rejects.toBeInstanceOf(
      GithubApiError,
    )
    expect(calls).toBe(1)
  })
})

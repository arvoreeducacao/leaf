export const GITHUB_API_BASE =
  process.env.GITHUB_API_BASE?.trim() || 'https://api.github.com'

export const GITHUB_API_VERSION = '2022-11-28'

const pageSize = 100

const maxPages = 100

const maxAttempts = 5

const retryableStatuses = new Set([403, 408, 429, 500, 502, 503, 504])

export class GithubApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GithubApiError'
    this.status = status
  }
}

export type GithubFetch = typeof fetch

export type GithubPullRequest = Readonly<{
  id: number
  number: number
  title?: string | null
  state?: string | null
  draft?: boolean
  merged_at?: string | null
  updated_at?: string | null
  html_url?: string | null
  user?: { login?: string | null } | null
}>

export type GithubClient = Readonly<{
  pulls: (repo: string) => AsyncGenerator<GithubPullRequest>
}>

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('retry-after'))

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 60_000)
  }

  const remaining = Number(response?.headers.get('x-ratelimit-remaining'))
  const resetAt = Number(response?.headers.get('x-ratelimit-reset'))

  if (remaining === 0 && Number.isFinite(resetAt) && resetAt > 0) {
    const waitMs = resetAt * 1000 - Date.now()

    if (waitMs > 0) {
      return Math.min(waitMs, 60_000)
    }
  }

  return Math.min(1000 * 2 ** attempt, 30_000)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      },
      { once: true },
    )
  })
}

export function pullState(
  pull: GithubPullRequest,
): 'open' | 'merged' | 'closed' {
  if (pull.merged_at) {
    return 'merged'
  }

  return pull.state === 'closed' ? 'closed' : 'open'
}

export function createGithubClient(
  token: string,
  options: { fetch?: GithubFetch; signal?: AbortSignal } = {},
): GithubClient {
  const call = options.fetch ?? fetch

  async function request<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response | null = null

      try {
        response = await call(`${GITHUB_API_BASE}${path}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'leaf-github-sync',
            'X-GitHub-Api-Version': GITHUB_API_VERSION,
          },
          signal: options.signal,
        })
      } catch (error) {
        if (options.signal?.aborted || attempt >= maxAttempts - 1) {
          throw error
        }

        await sleep(retryDelayMs(null, attempt), options.signal)
        continue
      }

      if (response.ok) {
        return (await response.json()) as T
      }

      if (retryableStatuses.has(response.status) && attempt < maxAttempts - 1) {
        await sleep(retryDelayMs(response, attempt), options.signal)
        continue
      }

      throw new GithubApiError(
        response.status,
        `GET ${path} devolveu ${response.status}`,
      )
    }
  }

  return {
    pulls: async function* (repo) {
      for (let page = 1; page <= maxPages; page += 1) {
        const query = new URLSearchParams({
          direction: 'desc',
          page: String(page),
          per_page: String(pageSize),
          sort: 'updated',
          state: 'all',
        })
        const batch = await request<Array<GithubPullRequest>>(
          `/repos/${repo}/pulls?${query.toString()}`,
        )

        if (!Array.isArray(batch) || batch.length === 0) {
          return
        }

        for (const pull of batch) {
          yield pull
        }

        if (batch.length < pageSize) {
          return
        }
      }
    },
  }
}

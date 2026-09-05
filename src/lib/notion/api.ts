export const NOTION_API_BASE = 'https://api.notion.com/v1'

export const NOTION_API_VERSION =
  process.env.NOTION_API_VERSION?.trim() || '2022-06-28'

const pageSize = 100

export class NotionApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'NotionApiError'
    this.status = status
  }
}

export type NotionFetch = typeof fetch

export type NotionRichText = Readonly<{
  type?: string
  plain_text?: string
  href?: string | null
  annotations?: Readonly<{
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    color?: string
  }>
  mention?: Readonly<{
    type?: string
    page?: { id?: string }
    database?: { id?: string }
  }>
}>

export type NotionIcon = Readonly<{
  type?: string
  emoji?: string
  external?: { url?: string }
  file?: { url?: string }
  icon?: { name?: string; color?: string }
  custom_emoji?: { url?: string }
}>

export type NotionFile = Readonly<{
  type?: string
  file?: { url?: string }
  external?: { url?: string }
  name?: string
}>

export type NotionBlock = Readonly<{
  id: string
  type: string
  has_children?: boolean
  [key: string]: unknown
}>

export type NotionPageObject = Readonly<{
  id: string
  object?: string
  in_trash?: boolean
  archived?: boolean
  icon?: NotionIcon | null
  cover?: NotionFile | null
  created_time?: string
  last_edited_time?: string
  properties?: Record<string, unknown>
  parent?: Record<string, unknown>
}>

export type NotionPropertyConfig = Readonly<{
  id?: string
  type?: string
  name?: string
  [key: string]: unknown
}>

export type NotionDatabaseObject = Readonly<{
  id: string
  object?: string
  title?: Array<NotionRichText>
  is_inline?: boolean
  icon?: NotionIcon | null
  created_time?: string
  last_edited_time?: string
  parent?: Record<string, unknown>
  properties?: Record<string, NotionPropertyConfig>
}>

export type NotionComment = Readonly<{
  id: string
  discussion_id?: string
  created_time?: string
  created_by?: { id?: string }
  rich_text?: Array<NotionRichText>
}>

export type NotionUserObject = Readonly<{
  id: string
  name?: string | null
  person?: { email?: string | null }
}>

export type NotionList<T> = Readonly<{
  results: Array<T>
  has_more?: boolean
  next_cursor?: string | null
}>

export type NotionSearchResult = NotionPageObject

export type NotionClient = Readonly<{
  page: (id: string) => Promise<NotionPageObject>
  database: (id: string) => Promise<NotionDatabaseObject>
  children: (id: string) => AsyncGenerator<NotionBlock>
  rows: (databaseId: string) => AsyncGenerator<NotionPageObject>
  comments: (blockId: string) => AsyncGenerator<NotionComment>
  user: (id: string) => Promise<NotionUserObject>
  search: () => AsyncGenerator<NotionSearchResult>
  download: (url: string) => Promise<{ bytes: Uint8Array; contentType: string }>
}>

const maxAttempts = 5

const retryableStatuses = new Set([409, 429, 500, 502, 503, 504])

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('retry-after'))

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 60_000)
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

export function createNotionClient(
  token: string,
  options: { fetch?: NotionFetch; signal?: AbortSignal } = {},
): NotionClient {
  const call = options.fetch ?? fetch

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response | null = null

      try {
        response = await call(`${NOTION_API_BASE}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_API_VERSION,
            ...(init.headers ?? {}),
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

      if (
        retryableStatuses.has(response.status) &&
        attempt < maxAttempts - 1
      ) {
        await sleep(retryDelayMs(response, attempt), options.signal)
        continue
      }

      throw new NotionApiError(
        response.status,
        `${init.method ?? 'GET'} ${path} devolveu ${response.status}`,
      )
    }
  }

  async function* paginate<T>(
    read: (cursor: string | null) => Promise<NotionList<T>>,
  ): AsyncGenerator<T> {
    let cursor: string | null = null

    do {
      const page: NotionList<T> = await read(cursor)

      for (const item of page.results) {
        yield item
      }

      cursor = page.has_more ? (page.next_cursor ?? null) : null
    } while (cursor)
  }

  return {
    children: (id) =>
      paginate<NotionBlock>((cursor) => {
        const query = new URLSearchParams({ page_size: String(pageSize) })

        if (cursor) {
          query.set('start_cursor', cursor)
        }

        return request<NotionList<NotionBlock>>(
          `/blocks/${id}/children?${query.toString()}`,
        )
      }),

    comments: (blockId) =>
      paginate<NotionComment>((cursor) => {
        const query = new URLSearchParams({
          block_id: blockId,
          page_size: String(pageSize),
        })

        if (cursor) {
          query.set('start_cursor', cursor)
        }

        return request<NotionList<NotionComment>>(
          `/comments?${query.toString()}`,
        )
      }),

    database: (id) => request<NotionDatabaseObject>(`/databases/${id}`),

    download: async (url) => {
      for (let attempt = 0; ; attempt += 1) {
        let response: Response | null = null

        try {
          response = await call(url, { signal: options.signal })
        } catch (error) {
          if (options.signal?.aborted || attempt >= 2) {
            throw error
          }

          await sleep(retryDelayMs(null, attempt), options.signal)
          continue
        }

        if (response.ok) {
          return {
            bytes: new Uint8Array(await response.arrayBuffer()),
            contentType:
              response.headers.get('content-type') ??
              'application/octet-stream',
          }
        }

        if (response.status >= 500 && attempt < 2) {
          await sleep(retryDelayMs(response, attempt), options.signal)
          continue
        }

        throw new NotionApiError(response.status, `download ${response.status}`)
      }
    },

    page: (id) => request<NotionPageObject>(`/pages/${id}`),

    user: (id) => request<NotionUserObject>(`/users/${id}`),

    rows: (databaseId) =>
      paginate<NotionPageObject>((cursor) =>
        request<NotionList<NotionPageObject>>(
          `/databases/${databaseId}/query`,
          {
            body: JSON.stringify(
              cursor
                ? { page_size: pageSize, start_cursor: cursor }
                : { page_size: pageSize },
            ),
            method: 'POST',
          },
        ),
      ),

    search: () =>
      paginate<NotionSearchResult>((cursor) =>
        request<NotionList<NotionSearchResult>>('/search', {
          body: JSON.stringify(
            cursor
              ? { page_size: pageSize, start_cursor: cursor }
              : { page_size: pageSize },
          ),
          method: 'POST',
        }),
      ),
  }
}

export function plainText(rich: unknown): string {
  if (!Array.isArray(rich)) {
    return ''
  }

  return (rich as Array<NotionRichText>)
    .map((item) => item.plain_text ?? '')
    .join('')
}

export function fileUrl(file: unknown): string | null {
  if (!file || typeof file !== 'object') {
    return null
  }

  const value = file as NotionFile

  return value.file?.url ?? value.external?.url ?? null
}

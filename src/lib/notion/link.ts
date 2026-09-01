const idPattern = /[0-9a-f]{32}/gi

const notionHosts = new Set([
  'notion.so',
  'www.notion.so',
  'notion.site',
  'app.notion.com',
  'www.notion.com',
  'notion.com',
])

export function normalizeNotionId(value: string): string | null {
  const compact = value.replace(/-/g, '').toLowerCase()

  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return null
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-')
}

export function notionIdFromLink(raw: string): string | null {
  const trimmed = raw.trim()

  if (trimmed.length === 0) {
    return null
  }

  const direct = normalizeNotionId(trimmed)

  if (direct) {
    return direct
  }

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()

  if (!notionHosts.has(host) && !host.endsWith('.notion.site')) {
    return null
  }

  const inPath = url.pathname.match(idPattern)

  if (inPath && inPath.length > 0) {
    return normalizeNotionId(inPath[inPath.length - 1])
  }

  const peeked = url.searchParams.get('p')

  return peeked ? normalizeNotionId(peeked) : null
}

const documentIdPattern = /^[A-Za-z0-9_-]{1,64}$/
const documentPathPattern = /^\/doc\/([A-Za-z0-9_-]{1,64})\/?$/
const hrefInContentPattern = /"href"\s*:\s*"([^"]{1,2048})"/g

export const maxLinkedDocuments = 200

export function documentIdFromHref(
  href: string | null | undefined,
  origin?: string,
): string | null {
  if (typeof href !== 'string' || href.length === 0) {
    return null
  }

  const path = href.startsWith('/')
    ? href.split('?')[0].split('#')[0]
    : pathOfSameOrigin(href, origin)

  if (path === null) {
    return null
  }

  const match = documentPathPattern.exec(path)

  return match ? match[1] : null
}

function pathOfSameOrigin(href: string, origin?: string): string | null {
  if (!origin) {
    return null
  }

  try {
    const url = new URL(href, origin)

    return url.origin === origin ? url.pathname : null
  } catch {
    return null
  }
}

export function documentIdsInContent(
  content: string | null | undefined,
  origin?: string,
): Array<string> {
  if (typeof content !== 'string' || content.length === 0) {
    return []
  }

  const ids = new Set<string>()

  for (const match of content.matchAll(hrefInContentPattern)) {
    const id = documentIdFromHref(match[1], origin)

    if (id !== null) {
      ids.add(id)

      if (ids.size >= maxLinkedDocuments) {
        break
      }
    }
  }

  return [...ids]
}

export function documentIdsFromQuery(value: string | null): Array<string> {
  if (!value) {
    return []
  }

  const ids = new Set<string>()

  for (const piece of value.split(',')) {
    const id = piece.trim()

    if (documentIdPattern.test(id)) {
      ids.add(id)
    }
  }

  return [...ids].slice(0, maxLinkedDocuments)
}

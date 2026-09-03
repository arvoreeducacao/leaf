const maxTextLength = 64
const maxUrlLength = 1024
const notionLibraryPrefix = 'https://www.notion.so/icons/'
const schemeLike = /^([a-z][a-z0-9+.-]*:)?\/\//i

export type DocumentIconSource =
  | Readonly<{ kind: 'image'; url: string; fromNotionLibrary: boolean }>
  | Readonly<{ kind: 'text'; text: string }>

function httpsIconUrl(value: string): string | null {
  if (value.length > maxUrlLength) {
    return null
  }

  try {
    const url = new URL(value)

    return url.protocol === 'https:' && url.hostname.length > 0 ? value : null
  } catch {
    return null
  }
}

export function readDocumentIcon(
  value: string | null | undefined,
): DocumentIconSource | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  const url = httpsIconUrl(trimmed)

  if (url) {
    return {
      kind: 'image',
      url,
      fromNotionLibrary: url.startsWith(notionLibraryPrefix),
    }
  }

  if (schemeLike.test(trimmed) || trimmed.length > maxTextLength) {
    return null
  }

  return { kind: 'text', text: trimmed }
}

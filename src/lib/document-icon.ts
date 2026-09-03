const maxTextLength = 64
const maxUrlLength = 1024
const notionLibraryPrefix = 'https://www.notion.so/icons/'
const schemeLike = /^([a-z][a-z0-9+.-]*:)?\/\//i
const galleryName = /^[a-z0-9-]{1,64}$/
const galleryColor = /^[a-z]{1,20}$/
const defaultGalleryColor = 'gray'

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

export type NotionIconPayload = Readonly<{
  emoji?: string
  external?: { url?: string }
  file?: { url?: string }
  icon?: { name?: string; color?: string }
  custom_emoji?: { url?: string }
}>

export function notionGalleryIconUrl(
  name: string | undefined,
  color: string | undefined,
): string | null {
  const shade = color ?? defaultGalleryColor

  if (!name || !galleryName.test(name) || !galleryColor.test(shade)) {
    return null
  }

  return `${notionLibraryPrefix}${name}_${shade}.svg`
}

export function notionIconValue(
  icon: NotionIconPayload | null | undefined,
): string | null {
  if (!icon) {
    return null
  }

  if (typeof icon.emoji === 'string' && icon.emoji.length > 0) {
    return icon.emoji.slice(0, maxTextLength)
  }

  const gallery = notionGalleryIconUrl(icon.icon?.name, icon.icon?.color)

  if (gallery) {
    return gallery
  }

  const url =
    icon.external?.url ?? icon.file?.url ?? icon.custom_emoji?.url ?? null

  return typeof url === 'string' && url.startsWith('https://')
    ? url.slice(0, maxUrlLength)
    : null
}

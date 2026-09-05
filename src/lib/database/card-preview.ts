type BlockLike = Readonly<{
  type?: unknown
  props?: unknown
  children?: unknown
}>

function imageUrlOf(block: BlockLike): string | null {
  if (block.type !== 'image' || !block.props || typeof block.props !== 'object') {
    return null
  }

  const url = (block.props as { url?: unknown }).url

  if (typeof url !== 'string') {
    return null
  }

  const trimmed = url.trim()

  const safe =
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')

  return safe ? trimmed : null
}

export function firstImageInBlocks(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) {
    return null
  }

  for (const item of blocks) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const block = item as BlockLike
    const url = imageUrlOf(block)

    if (url) {
      return url
    }

    const nested = firstImageInBlocks(block.children)

    if (nested) {
      return nested
    }
  }

  return null
}

export function firstImageInContent(content: string | null): string | null {
  if (!content) {
    return null
  }

  try {
    return firstImageInBlocks(JSON.parse(content))
  } catch {
    return null
  }
}

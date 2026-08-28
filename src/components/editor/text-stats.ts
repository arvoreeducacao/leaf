type InlineLike = Readonly<{
  type?: string
  text?: string
  content?: unknown
}>

type BlockLike = Readonly<{
  content?: unknown
  children?: unknown
}>

export type TextStats = Readonly<{ words: number; characters: number }>

function collectInline(node: unknown, parts: Array<string>) {
  if (typeof node === 'string') {
    parts.push(node)

    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectInline(item, parts)
    }

    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  const inline = node as InlineLike

  if (typeof inline.text === 'string') {
    parts.push(inline.text)
  }

  if (inline.content !== undefined) {
    collectInline(inline.content, parts)
  }

  const rows = (node as { rows?: unknown }).rows

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const cells = (row as { cells?: unknown })?.cells

      if (!Array.isArray(cells)) {
        continue
      }

      for (const cell of cells) {
        collectInline(cell, parts)
        parts.push('\n')
      }
    }
  }
}

export function blocksToPlainText(blocks: unknown): string {
  const parts: Array<string> = []

  function walk(list: unknown) {
    if (!Array.isArray(list)) {
      return
    }

    for (const item of list) {
      if (!item || typeof item !== 'object') {
        continue
      }

      const block = item as BlockLike

      if (block.content !== undefined) {
        collectInline(block.content, parts)
      }

      parts.push('\n')
      walk(block.children)
    }
  }

  walk(blocks)

  return parts.join('')
}

export function countTextStats(text: string): TextStats {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const words = normalized.length === 0 ? 0 : normalized.split(' ').length

  return { words, characters: normalized.length }
}

export function statsFromBlocks(blocks: unknown): TextStats {
  return countTextStats(blocksToPlainText(blocks))
}

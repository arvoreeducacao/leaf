import { isEmbeddableUrl } from './embed-providers'

type LegacyInline = Readonly<{
  type?: string
  text?: string
  href?: string
}>

type LegacyBlock = {
  id?: string
  type?: string
  props?: Record<string, unknown>
  content?: unknown
  children?: Array<LegacyBlock>
}

export type LegacyConversion = Readonly<{
  blocks: Array<LegacyBlock>
  changed: number
}>

function textOf(item: LegacyInline) {
  return typeof item.text === 'string' ? item.text : ''
}

function urlOf(item: LegacyInline) {
  if (item.type === 'link' && typeof item.href === 'string') {
    return item.href
  }

  const text = textOf(item).trim()

  return item.type === 'text' && /^https?:\/\/\S+$/u.test(text) ? text : null
}

export function loneEmbeddableLink(block: LegacyBlock): string | null {
  if (block.type !== 'paragraph' || !Array.isArray(block.content)) {
    return null
  }

  if (Array.isArray(block.children) && block.children.length > 0) {
    return null
  }

  const meaningful = (block.content as Array<LegacyInline>).filter(
    (item) => item?.type !== 'text' || textOf(item).trim().length > 0,
  )

  if (meaningful.length !== 1) {
    return null
  }

  const url = urlOf(meaningful[0])

  return url !== null && isEmbeddableUrl(url) ? url : null
}

export function convertLegacyLinkBlocks(value: unknown): LegacyConversion {
  if (!Array.isArray(value)) {
    return { blocks: [], changed: 0 }
  }

  let changed = 0

  const blocks = (value as Array<LegacyBlock>).map((block) => {
    const url = loneEmbeddableLink(block)

    if (url !== null) {
      changed += 1

      return {
        children: [],
        id: block.id,
        props: { caption: '', url },
        type: 'embed',
      }
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      const result = convertLegacyLinkBlocks(block.children)

      changed += result.changed

      return result.changed > 0 ? { ...block, children: result.blocks } : block
    }

    return block
  })

  return { blocks, changed }
}

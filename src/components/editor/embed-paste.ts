import { isEmbeddableUrl } from './embed-providers'

type PastedBlock = Readonly<{ type: string; content?: unknown }>

export function embeddablePastedUrl(value: string | null | undefined) {
  const text = value?.trim() ?? ''

  if (text.length === 0 || /\s/u.test(text)) {
    return null
  }

  return isEmbeddableUrl(text) ? text : null
}

export function acceptsEmbedPaste(block: PastedBlock | null | undefined) {
  return (
    block?.type === 'paragraph' &&
    Array.isArray(block.content) &&
    block.content.length === 0
  )
}

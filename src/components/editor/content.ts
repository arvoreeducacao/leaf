import type { LeafBlock } from './types'

const emptyDocument: LeafBlock[] = [{ type: 'paragraph' }]

export function parseDocumentContent(content: string | null): LeafBlock[] {
  if (!content) {
    return emptyDocument
  }

  try {
    const parsed: unknown = JSON.parse(content)

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return emptyDocument
    }

    return parsed as LeafBlock[]
  } catch {
    return emptyDocument
  }
}

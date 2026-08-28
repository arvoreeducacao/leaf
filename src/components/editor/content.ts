import type { LeafBlock } from './types'

const emptyDocument: LeafBlock[] = [{ type: 'paragraph' }]

export type DocumentContent =
  | Readonly<{ status: 'ok'; blocks: LeafBlock[] }>
  | Readonly<{ status: 'unreadable' }>

export function readDocumentContent(content: string | null): DocumentContent {
  if (!content || content.trim().length === 0) {
    return { status: 'ok', blocks: emptyDocument }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    return { status: 'unreadable' }
  }

  if (!Array.isArray(parsed)) {
    return { status: 'unreadable' }
  }

  if (parsed.length === 0) {
    return { status: 'ok', blocks: emptyDocument }
  }

  return { status: 'ok', blocks: parsed as LeafBlock[] }
}

export function parseDocumentContent(content: string | null): LeafBlock[] {
  const result = readDocumentContent(content)

  return result.status === 'ok' ? result.blocks : emptyDocument
}

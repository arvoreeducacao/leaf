import { documentIdFromHref } from '@/lib/document-links'

type TextNode = { type: 'text'; text: string; styles?: Record<string, unknown> }

type LinkNode = {
  type: 'link'
  href: string
  content: Array<TextNode>
}

type InlineNode = TextNode | LinkNode | { type: string; [key: string]: unknown }

type Block = {
  content?: unknown
  children?: Array<Block>
  [key: string]: unknown
}

function isLink(node: InlineNode): node is LinkNode {
  return (
    node.type === 'link' &&
    typeof (node as LinkNode).href === 'string' &&
    Array.isArray((node as LinkNode).content)
  )
}

function linkText(node: LinkNode): string {
  return node.content
    .map((piece) => (typeof piece.text === 'string' ? piece.text : ''))
    .join('')
}

function retitleLink(node: LinkNode, title: string): LinkNode {
  const [first] = node.content

  return {
    ...node,
    content: [{ type: 'text', text: title, styles: first?.styles ?? {} }],
  }
}

function retitleInline(
  nodes: Array<InlineNode>,
  documentId: string,
  previousTitle: string,
  title: string,
  origin: string,
): { nodes: Array<InlineNode>; changed: boolean } {
  let changed = false

  const next = nodes.map((node) => {
    if (!isLink(node)) {
      return node
    }

    if (documentIdFromHref(node.href, origin) !== documentId) {
      return node
    }

    if (linkText(node).trim() !== previousTitle.trim()) {
      return node
    }

    changed = true

    return retitleLink(node, title)
  })

  return { nodes: next, changed }
}

function retitleContent(
  content: unknown,
  documentId: string,
  previousTitle: string,
  title: string,
  origin: string,
): { content: unknown; changed: boolean } {
  if (Array.isArray(content)) {
    const inline = retitleInline(
      content as Array<InlineNode>,
      documentId,
      previousTitle,
      title,
      origin,
    )

    return { content: inline.nodes, changed: inline.changed }
  }

  if (!content || typeof content !== 'object') {
    return { content, changed: false }
  }

  const table = content as { type?: string; rows?: Array<{ cells?: unknown }> }

  if (table.type !== 'tableContent' || !Array.isArray(table.rows)) {
    return { content, changed: false }
  }

  let changed = false

  const rows = table.rows.map((row) => {
    if (!Array.isArray(row.cells)) {
      return row
    }

    const cells = row.cells.map((cell) => {
      const cellContent = Array.isArray(cell)
        ? cell
        : (cell as { content?: unknown })?.content

      const result = retitleContent(
        cellContent,
        documentId,
        previousTitle,
        title,
        origin,
      )

      if (!result.changed) {
        return cell
      }

      changed = true

      return Array.isArray(cell)
        ? result.content
        : { ...(cell as object), content: result.content }
    })

    return { ...row, cells }
  })

  return { content: { ...table, rows }, changed }
}

export function retitleDocumentLinks(
  blocks: ReadonlyArray<Block>,
  documentId: string,
  previousTitle: string,
  title: string,
  origin: string,
): { blocks: Array<Block>; changed: boolean } {
  let changed = false

  const next = blocks.map((block) => {
    const content = retitleContent(
      block.content,
      documentId,
      previousTitle,
      title,
      origin,
    )
    const children = Array.isArray(block.children)
      ? retitleDocumentLinks(
          block.children,
          documentId,
          previousTitle,
          title,
          origin,
        )
      : null

    if (!content.changed && !children?.changed) {
      return block
    }

    changed = true

    return {
      ...block,
      ...(content.changed ? { content: content.content } : {}),
      ...(children?.changed ? { children: children.blocks } : {}),
    }
  })

  return { blocks: next, changed }
}

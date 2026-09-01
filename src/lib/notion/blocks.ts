import type { NotionBlock, NotionRichText } from '@/lib/notion/api'
import { fileUrl, plainText } from '@/lib/notion/api'
import { notionIdFromLink } from '@/lib/notion/link'

export type BlockContext = Readonly<{
  assetPath: (url: string, fallbackName: string) => string | null
  pagePath: (id: string) => string | null
}>

export type MarkdownResult = Readonly<{
  markdown: string
  toggles: number
}>

const indent = '\t'

function escapeText(value: string): string {
  return value.replace(/([\\`*_[\]])/g, '\\$1')
}

function inline(rich: unknown, context: BlockContext): string {
  if (!Array.isArray(rich)) {
    return ''
  }

  return (rich as Array<NotionRichText>)
    .map((item) => {
      const text = item.plain_text ?? ''

      if (text.length === 0) {
        return ''
      }

      const annotations = item.annotations ?? {}
      let out = annotations.code ? `\`${text}\`` : escapeText(text)

      if (annotations.bold) {
        out = `**${out}**`
      }

      if (annotations.italic) {
        out = `*${out}*`
      }

      if (annotations.strikethrough) {
        out = `~~${out}~~`
      }

      if (!item.href) {
        return out
      }

      return `[${out}](${linkTarget(item.href, context)})`
    })
    .join('')
}

function linkTarget(href: string, context: BlockContext): string {
  const id = notionIdFromLink(href.replace(/^\//, ''))
  const page = id ? context.pagePath(id) : null

  return page ?? href
}

function body(block: NotionBlock): Record<string, unknown> {
  const value = block[block.type]

  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function caption(block: NotionBlock, context: BlockContext): string {
  return inline(body(block).caption, context)
}

function media(
  block: NotionBlock,
  context: BlockContext,
  bang: string,
): string | null {
  const content = body(block)
  const url = fileUrl(content)

  if (!url) {
    return null
  }

  const name = (content.name as string | undefined) ?? block.type
  const label = caption(block, context) || (bang === '!' ? '' : name)
  const local = context.assetPath(url, name)

  return `${bang}[${label}](${local ?? url})`
}

export function blockToMarkdown(
  block: NotionBlock,
  context: BlockContext,
  depth: number,
): { lines: Array<string>; toggles: number } {
  const pad = indent.repeat(depth)
  const content = body(block)
  const text = inline(content.rich_text, context)

  function line(value: string) {
    return { lines: [`${pad}${value}`], toggles: 0 }
  }

  switch (block.type) {
    case 'paragraph':
      return line(text)

    case 'heading_1':
      return line(`# ${text}`)

    case 'heading_2':
      return line(`## ${text}`)

    case 'heading_3':
      return line(`### ${text}`)

    case 'bulleted_list_item':
      return line(`- ${text}`)

    case 'numbered_list_item':
      return line(`1. ${text}`)

    case 'to_do':
      return line(`- [${content.checked ? 'x' : ' '}] ${text}`)

    case 'quote':
      return line(`> ${text}`)

    case 'callout': {
      const icon =
        typeof content.icon === 'object' && content.icon !== null
          ? ((content.icon as { emoji?: string }).emoji ?? '')
          : ''

      return line(`> ${icon ? `${icon} ` : ''}${text}`)
    }

    case 'code': {
      const language = (content.language as string | undefined) ?? ''
      const source = plainText(content.rich_text)

      return {
        lines: [
          `${pad}\`\`\`${language}`,
          ...source.split('\n').map((row) => `${pad}${row}`),
          `${pad}\`\`\``,
        ],
        toggles: 0,
      }
    }

    case 'divider':
      return line('---')

    case 'equation':
      return line(`\`${(content.expression as string | undefined) ?? ''}\``)

    case 'image':
      return line(media(block, context, '!') ?? '')

    case 'video':
    case 'audio':
    case 'file':
    case 'pdf':
      return line(media(block, context, '') ?? '')

    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = (content.url as string | undefined) ?? ''

      return line(url ? `[${caption(block, context) || url}](${url})` : '')
    }

    case 'toggle':
      return { lines: [`${pad}**${text}**`], toggles: 1 }

    case 'child_page': {
      const target = context.pagePath(block.id)
      const title = (content.title as string | undefined) ?? ''

      return line(target ? `[${title}](${target})` : title)
    }

    case 'child_database': {
      const target = context.pagePath(block.id)
      const title = (content.title as string | undefined) ?? ''

      return line(target ? `[${title}](${target})` : title)
    }

    default:
      return line(text)
  }
}

export type BlockNode = Readonly<{
  block: NotionBlock
  children: Array<BlockNode>
}>

function tableLines(
  node: BlockNode,
  context: BlockContext,
  depth: number,
): Array<string> {
  const pad = indent.repeat(depth)
  const rows = node.children
    .filter((child) => child.block.type === 'table_row')
    .map((child) => {
      const cells = body(child.block).cells

      return Array.isArray(cells)
        ? (cells as Array<unknown>).map((cell) => inline(cell, context))
        : []
    })

  if (rows.length === 0) {
    return []
  }

  const columns = Math.max(...rows.map((row) => row.length))
  const render = (cells: Array<string>) =>
    `${pad}| ${Array.from({ length: columns }, (_, index) => cells[index] ?? '').join(' | ')} |`

  const [header, ...rest] = rows

  return [
    '',
    render(header),
    `${pad}|${' --- |'.repeat(columns)}`,
    ...rest.map(render),
    '',
  ]
}

export function blocksToMarkdown(
  nodes: Array<BlockNode>,
  context: BlockContext,
  depth = 0,
): MarkdownResult {
  const lines: Array<string> = []
  let toggles = 0

  for (const node of nodes) {
    if (node.block.type === 'table') {
      lines.push(...tableLines(node, context, depth))
      continue
    }

    const converted = blockToMarkdown(node.block, context, depth)
    toggles += converted.toggles
    lines.push(...converted.lines)

    if (node.children.length === 0) {
      continue
    }

    const nested = blocksToMarkdown(node.children, context, depth + 1)
    toggles += nested.toggles

    if (nested.markdown.length > 0) {
      lines.push(nested.markdown)
    }
  }

  return { markdown: lines.join('\n'), toggles }
}

import { isEmbeddableUrl } from '@/components/editor/embed-providers'
import type { NotionBlock, NotionRichText } from '@/lib/notion/api'
import { fileUrl, plainText } from '@/lib/notion/api'
import { notionIdFromLink } from '@/lib/notion/link'

export type BlockNode = Readonly<{
  block: NotionBlock
  children: Array<BlockNode>
}>

export type ImportedInline = Record<string, unknown>

export type ImportedBlock = {
  type: string
  props?: Record<string, unknown>
  content?: unknown
  children?: Array<ImportedBlock>
}

export type ConvertContext = Readonly<{
  assetPath: (url: string, fallbackName: string) => string | null
  pageRef: (id: string) => string | null
  unsupported: (type: string) => void
  isInlineDatabase?: (id: string) => boolean
}>

const blockColors = new Set([
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
])

const childlessTypes = new Set([
  'table',
  'embed',
  'divider',
  'codeBlock',
  'image',
  'video',
  'audio',
  'file',
  'database',
  'pageBreak',
])

function splitColor(value: unknown): {
  textColor?: string
  backgroundColor?: string
} {
  if (typeof value !== 'string' || value === 'default') {
    return {}
  }

  if (value.endsWith('_background')) {
    const color = value.slice(0, -'_background'.length)

    return blockColors.has(color) ? { backgroundColor: color } : {}
  }

  return blockColors.has(value) ? { textColor: value } : {}
}

function styledText(
  text: string,
  styles: Record<string, unknown>,
): ImportedInline {
  return { type: 'text', text, styles }
}

function stylesOf(item: NotionRichText): Record<string, unknown> {
  const annotations = item.annotations ?? {}
  const styles: Record<string, unknown> = {}

  if (annotations.bold) {
    styles.bold = true
  }

  if (annotations.italic) {
    styles.italic = true
  }

  if (annotations.strikethrough) {
    styles.strike = true
  }

  if (annotations.underline) {
    styles.underline = true
  }

  if (annotations.code) {
    styles.code = true
  }

  const color = splitColor(annotations.color)

  if (color.textColor) {
    styles.textColor = color.textColor
  }

  if (color.backgroundColor) {
    styles.backgroundColor = color.backgroundColor
  }

  return styles
}

function linkInline(href: string, inner: ImportedInline): ImportedInline {
  return { type: 'link', href, content: [inner] }
}

export function richTextToInline(
  rich: unknown,
  context: ConvertContext,
): Array<ImportedInline> {
  if (!Array.isArray(rich)) {
    return []
  }

  const inline: Array<ImportedInline> = []

  for (const item of rich as Array<NotionRichText>) {
    const text = item.plain_text ?? ''

    if (text.length === 0) {
      continue
    }

    if (item.type === 'equation') {
      inline.push(styledText(text, { ...stylesOf(item), code: true }))
      continue
    }

    if (item.type === 'mention') {
      const mention = item.mention ?? {}
      const targetId = mention.page?.id ?? mention.database?.id ?? null
      const target = targetId ? context.pageRef(targetId) : null
      const piece = styledText(text, stylesOf(item))

      inline.push(target ? linkInline(target, piece) : piece)
      continue
    }

    const piece = styledText(text, stylesOf(item))

    if (!item.href) {
      inline.push(piece)
      continue
    }

    const linkedId = notionIdFromLink(item.href.replace(/^\//, ''))
    const target = linkedId ? context.pageRef(linkedId) : null

    inline.push(linkInline(target ?? item.href, piece))
  }

  return inline
}

function body(block: NotionBlock): Record<string, unknown> {
  const value = block[block.type]

  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function captionText(content: Record<string, unknown>): string {
  return plainText(content.caption)
}

function colorProps(content: Record<string, unknown>): Record<string, unknown> {
  const color = splitColor(content.color)
  const props: Record<string, unknown> = {}

  if (color.textColor) {
    props.textColor = color.textColor
  }

  if (color.backgroundColor) {
    props.backgroundColor = color.backgroundColor
  }

  return props
}

function mediaProps(
  block: NotionBlock,
  context: ConvertContext,
): Record<string, unknown> | null {
  const content = body(block)
  const url = fileUrl(content)

  if (!url) {
    return null
  }

  const name =
    typeof content.name === 'string' && content.name.length > 0
      ? content.name
      : block.type
  const local = context.assetPath(url, name)
  const props: Record<string, unknown> = { name, url: local ?? url }
  const caption = captionText(content)

  if (caption.length > 0) {
    props.caption = caption
  }

  return props
}

function linkParagraph(url: string, label: string): ImportedBlock {
  return {
    content: [linkInline(url, styledText(label, {}))],
    type: 'paragraph',
  }
}

function calloutIcon(content: Record<string, unknown>): string {
  const icon = content.icon

  if (icon && typeof icon === 'object') {
    const emoji = (icon as { emoji?: unknown }).emoji

    if (typeof emoji === 'string' && emoji.length > 0) {
      return emoji
    }
  }

  return ''
}

function tableBlock(
  node: BlockNode,
  context: ConvertContext,
): ImportedBlock | null {
  const content = body(node.block)
  const rows = node.children
    .filter((child) => child.block.type === 'table_row')
    .map((child) => {
      const cells = body(child.block).cells

      return {
        cells: Array.isArray(cells)
          ? (cells as Array<unknown>).map((cell) =>
              richTextToInline(cell, context),
            )
          : [],
      }
    })

  if (rows.length === 0) {
    return null
  }

  const tableContent: Record<string, unknown> = {
    rows,
    type: 'tableContent',
  }

  if (content.has_column_header === true) {
    tableContent.headerRows = 1
  }

  if (content.has_row_header === true) {
    tableContent.headerCols = 1
  }

  return { content: tableContent, type: 'table' }
}

function convertNode(
  node: BlockNode,
  context: ConvertContext,
): Array<ImportedBlock> {
  const block = node.block
  const content = body(block)
  const inline = () => richTextToInline(content.rich_text, context)

  function withChildren(converted: ImportedBlock): Array<ImportedBlock> {
    if (node.children.length === 0 || block.type === 'table') {
      return [converted]
    }

    const children = convertNodes(node.children, context)

    if (children.length === 0) {
      return [converted]
    }

    if (childlessTypes.has(converted.type)) {
      return [converted, ...children]
    }

    return [{ ...converted, children }]
  }

  switch (block.type) {
    case 'paragraph':
      return withChildren({
        content: inline(),
        props: colorProps(content),
        type: 'paragraph',
      })

    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = Number(block.type.slice(-1))
      const props: Record<string, unknown> = {
        level,
        ...colorProps(content),
      }

      if (content.is_toggleable === true) {
        props.isToggleable = true
      }

      return withChildren({ content: inline(), props, type: 'heading' })
    }

    case 'bulleted_list_item':
      return withChildren({
        content: inline(),
        props: colorProps(content),
        type: 'bulletListItem',
      })

    case 'numbered_list_item':
      return withChildren({
        content: inline(),
        props: colorProps(content),
        type: 'numberedListItem',
      })

    case 'to_do':
      return withChildren({
        content: inline(),
        props: { checked: content.checked === true, ...colorProps(content) },
        type: 'checkListItem',
      })

    case 'toggle':
      return withChildren({
        content: inline(),
        props: colorProps(content),
        type: 'toggleListItem',
      })

    case 'quote':
      return withChildren({
        content: inline(),
        props: colorProps(content),
        type: 'quote',
      })

    case 'callout':
      return withChildren({
        content: inline(),
        props: { icon: calloutIcon(content), ...colorProps(content) },
        type: 'callout',
      })

    case 'code': {
      const language =
        typeof content.language === 'string' ? content.language : 'text'

      return withChildren({
        content: [styledText(plainText(content.rich_text), {})],
        props: { language },
        type: 'codeBlock',
      })
    }

    case 'equation': {
      const expression =
        typeof content.expression === 'string' ? content.expression : ''

      return [
        {
          content: [styledText(expression, {})],
          props: { language: 'latex' },
          type: 'codeBlock',
        },
      ]
    }

    case 'divider':
      return [{ type: 'divider' }]

    case 'table': {
      const table = tableBlock(node, context)

      return table ? [table] : []
    }

    case 'column_list': {
      const columns = node.children
        .filter((child) => child.block.type === 'column')
        .map((child) => ({
          children: convertNodes(child.children, context),
          type: 'column',
        }))
        .filter((column) => column.children.length > 0)

      if (columns.length < 2) {
        return columns.flatMap((column) => column.children)
      }

      return [{ children: columns, type: 'columnList' }]
    }

    case 'image': {
      const props = mediaProps(block, context)

      return props
        ? withChildren({ props, type: 'image' })
        : []
    }

    case 'video':
    case 'audio':
    case 'file': {
      const props = mediaProps(block, context)

      return props ? withChildren({ props, type: block.type }) : []
    }

    case 'pdf': {
      const props = mediaProps(block, context)

      return props ? withChildren({ props, type: 'file' }) : []
    }

    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = typeof content.url === 'string' ? content.url : ''

      if (url.length === 0) {
        return []
      }

      const caption = captionText(content)

      if (isEmbeddableUrl(url)) {
        return withChildren({ props: { caption, url }, type: 'embed' })
      }

      return withChildren(linkParagraph(url, caption.length > 0 ? caption : url))
    }

    case 'synced_block':
      return convertNodes(node.children, context)

    case 'child_page': {
      const target = context.pageRef(block.id)
      const title =
        typeof content.title === 'string' && content.title.length > 0
          ? content.title
          : block.id

      return target ? [linkParagraph(target, title)] : []
    }

    case 'child_database': {
      const target = context.pageRef(block.id)

      if (!target) {
        return []
      }

      if (context.isInlineDatabase && !context.isInlineDatabase(block.id)) {
        const title =
          typeof content.title === 'string' && content.title.length > 0
            ? content.title
            : target

        return [
          {
            content: [linkInline(target, styledText(title, {}))],
            type: 'paragraph',
          },
        ]
      }

      return [{ props: { databaseId: target }, type: 'database' }]
    }

    case 'link_to_page': {
      const targetId =
        typeof content.page_id === 'string'
          ? content.page_id
          : typeof content.database_id === 'string'
            ? content.database_id
            : null
      const target = targetId ? context.pageRef(targetId) : null

      return target ? [linkParagraph(target, target)] : []
    }

    case 'table_of_contents':
    case 'breadcrumb':
    case 'template':
    case 'column':
    case 'table_row':
      context.unsupported(block.type)

      return convertNodes(node.children, context)

    default: {
      const text = richTextToInline(content.rich_text, context)

      if (text.length > 0) {
        return withChildren({ content: text, type: 'paragraph' })
      }

      context.unsupported(block.type)

      return convertNodes(node.children, context)
    }
  }
}

export function convertNodes(
  nodes: Array<BlockNode>,
  context: ConvertContext,
): Array<ImportedBlock> {
  return nodes.flatMap((node) => convertNode(node, context))
}

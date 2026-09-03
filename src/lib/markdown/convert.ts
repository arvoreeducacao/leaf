import type { PartialBlock } from '@blocknote/core'
import { ServerBlockNoteEditor } from '@blocknote/server-util'

import { leafServerSchema } from '@/components/editor/server-schema'
import {
  sanitizeBlocks,
  sanitizeHtml,
  sanitizeMarkdown,
} from '@/lib/markdown/sanitize'

let serverEditor: ServerBlockNoteEditor<
  typeof leafServerSchema.blockSchema,
  typeof leafServerSchema.inlineContentSchema,
  typeof leafServerSchema.styleSchema
> | null = null

function getServerEditor() {
  if (!serverEditor) {
    serverEditor = ServerBlockNoteEditor.create({ schema: leafServerSchema })
  }

  return serverEditor
}

export function parseContentBlocks(content: string | null): Array<PartialBlock> {
  if (!content) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(content)

    if (!Array.isArray(parsed)) {
      return []
    }

    return sanitizeBlocks(parsed) as Array<PartialBlock>
  } catch {
    return []
  }
}

const urlKeys = ['url', 'src', 'href'] as const

function absoluteUrl(value: string, origin: string) {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return value
  }

  return `${origin}${value}`
}

export function absolutizeBlocks<T>(blocks: T, origin: string): T {
  if (origin.length === 0) {
    return blocks
  }

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map(walk)
    }

    if (!node || typeof node !== 'object') {
      return node
    }

    const source = node as Record<string, unknown>
    const next: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(source)) {
      if (
        typeof value === 'string' &&
        (urlKeys as ReadonlyArray<string>).includes(key)
      ) {
        next[key] = absoluteUrl(value, origin)
        continue
      }

      next[key] = walk(value)
    }

    return next
  }

  return walk(blocks) as T
}

export function fixExportedHTML(html: string): string {
  return html.replace(/\sclassname=(["'])/g, ' class=$1')
}

export async function markdownToBlocks(
  markdown: string,
): Promise<Array<PartialBlock>> {
  const blocks = await getServerEditor().tryParseMarkdownToBlocks(
    sanitizeMarkdown(markdown),
  )

  return sanitizeBlocks(blocks) as Array<PartialBlock>
}

export async function markdownToContent(markdown: string): Promise<string> {
  return JSON.stringify(await markdownToBlocks(markdown))
}

export async function htmlToBlocks(html: string): Promise<Array<PartialBlock>> {
  const safe = sanitizeHtml(html)

  if (safe.trim().length === 0) {
    return []
  }

  const blocks = await getServerEditor().tryParseHTMLToBlocks(safe)

  return sanitizeBlocks(blocks) as Array<PartialBlock>
}

export async function htmlToContent(html: string): Promise<string> {
  return JSON.stringify(await htmlToBlocks(html))
}

export async function contentToMarkdown(
  content: string | null,
  origin = '',
): Promise<string> {
  const blocks = absolutizeBlocks(parseContentBlocks(content), origin)

  if (blocks.length === 0) {
    return ''
  }

  return getServerEditor().blocksToMarkdownLossy(blocks)
}

function blockPlainText(block: PartialBlock | undefined) {
  const content = (block as { content?: unknown } | undefined)?.content

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((item) =>
      item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
        ? ((item as { text: string }).text)
        : '',
    )
    .join('')
    .trim()
}

function repeatsTitle(block: PartialBlock | undefined, title: string) {
  return (
    (block as { type?: string } | undefined)?.type === 'heading' &&
    ((block as { props?: { level?: number } } | undefined)?.props?.level ?? 1) ===
      1 &&
    blockPlainText(block) === title.trim()
  )
}

export function documentToMarkdownFile(
  title: string,
  body: string,
  blocks: Array<PartialBlock>,
): string {
  return repeatsTitle(blocks[0], title) ? body : `# ${title}\n\n${body}`
}

export async function contentToHTML(
  content: string | null,
  title = 'Document',
  origin = '',
): Promise<string> {
  const blocks = absolutizeBlocks(parseContentBlocks(content), origin)
  const body =
    blocks.length === 0
      ? ''
      : fixExportedHTML(await getServerEditor().blocksToHTMLLossy(blocks))
  const safeTitle = escapeHTML(title)
  const heading = repeatsTitle(blocks[0], title) ? '' : `<h1>${safeTitle}</h1>`

  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safeTitle}</title>`,
    '</head>',
    '<body>',
    heading,
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

function escapeHTML(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

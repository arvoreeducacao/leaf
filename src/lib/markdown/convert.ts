import type { PartialBlock } from '@blocknote/core'
import { ServerBlockNoteEditor } from '@blocknote/server-util'

import { sanitizeBlocks, sanitizeMarkdown } from '@/lib/markdown/sanitize'

let serverEditor: ServerBlockNoteEditor | null = null

function getServerEditor() {
  if (!serverEditor) {
    serverEditor = ServerBlockNoteEditor.create()
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

export async function markdownToContent(markdown: string): Promise<string> {
  const blocks = await getServerEditor().tryParseMarkdownToBlocks(
    sanitizeMarkdown(markdown),
  )

  return JSON.stringify(sanitizeBlocks(blocks))
}

export async function contentToMarkdown(content: string | null): Promise<string> {
  const blocks = parseContentBlocks(content)

  if (blocks.length === 0) {
    return ''
  }

  return getServerEditor().blocksToMarkdownLossy(blocks)
}

export async function contentToHTML(
  content: string | null,
  title = 'Documento',
): Promise<string> {
  const blocks = parseContentBlocks(content)
  const body =
    blocks.length === 0 ? '' : await getServerEditor().blocksToHTMLLossy(blocks)
  const safeTitle = escapeHTML(title)

  return [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safeTitle}</title>`,
    '</head>',
    '<body>',
    `<h1>${safeTitle}</h1>`,
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

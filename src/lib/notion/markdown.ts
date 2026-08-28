import {
  decodeTarget,
  directoryOf,
  resolveRelativePath,
} from '@/lib/notion/paths'

const calloutMarker = '\u2063'

const emojiPrefixPattern =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}])+[\s ]*/u

const linkPattern =
  /(!?)\[([^\]\n]*)\]\(\s*<?([^)>\s]*)>?(?:\s+"([^"]*)")?\s*\)/g

const schemePattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

export type NotionLinkTarget =
  | { kind: 'document'; url: string }
  | { kind: 'image'; url: string }
  | { kind: 'file'; url: string; label: string }
  | { kind: 'missing' }

export function stripLeadingTitle(markdown: string, title: string): string {
  const lines = markdown.split('\n')
  let index = 0

  while (index < lines.length && lines[index].trim().length === 0) {
    index += 1
  }

  const heading = /^#{1,2}\s+(.*)$/.exec(lines[index] ?? '')

  if (!heading) {
    return markdown
  }

  if (normalizeTitle(heading[1]) !== normalizeTitle(title)) {
    return markdown
  }

  return lines.slice(index + 1).join('\n').replace(/^\n+/, '')
}

function normalizeTitle(value: string) {
  return value
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function convertAsides(markdown: string): string {
  return markdown.replace(
    /<aside>([\s\S]*?)<\/aside>/gi,
    (_, inner: string) => {
      const lines = inner
        .replace(/<\/?p>/gi, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      if (lines.length === 0) {
        return ''
      }

      const [first, ...rest] = lines

      return [
        '',
        `> ${calloutMarker}${first}`,
        ...rest.map((line) => `> ${line}`),
        '',
      ].join('\n')
    },
  )
}

export function convertToggles(markdown: string): {
  markdown: string
  toggles: number
} {
  let toggles = 0

  const withSummaries = markdown.replace(
    /<summary>([\s\S]*?)<\/summary>/gi,
    (_, inner: string) => {
      toggles += 1
      const text = inner.replace(/\s+/g, ' ').trim()

      return text.length > 0 ? `\n\n**${text}**\n` : ''
    },
  )

  return {
    markdown: withSummaries.replace(/<\/?details[^>]*>/gi, '\n'),
    toggles,
  }
}

export function rewriteLinks(
  markdown: string,
  sourcePath: string,
  resolve: (path: string) => NotionLinkTarget,
): { markdown: string; missing: number } {
  const directory = directoryOf(sourcePath)
  let missing = 0

  const result = markdown.replace(
    linkPattern,
    (match, bang: string, label: string, rawTarget: string) => {
      if (rawTarget.length === 0) {
        return match
      }

      if (schemePattern.test(rawTarget) || rawTarget.startsWith('#')) {
        return match
      }

      const decoded = decodeTarget(rawTarget)
      const resolved = resolveRelativePath(directory, decoded)
      const target = resolve(resolved)

      if (target.kind === 'missing') {
        missing += 1

        return label.length > 0 ? label : decoded
      }

      if (target.kind === 'document') {
        return `[${label.length > 0 ? label : decoded}](${target.url})`
      }

      if (target.kind === 'image') {
        return `${bang}[${label}](${target.url})`
      }

      return `[${label.length > 0 ? label : target.label}](${target.url})`
    },
  )

  return { markdown: result, missing }
}

type LooseBlock = Readonly<{
  type?: unknown
  content?: unknown
  children?: unknown
}>

export function promoteCallouts<T>(blocks: Array<T>): Array<T> {
  return blocks.map((item) => {
    const block = item as LooseBlock
    const children = Array.isArray(block.children)
      ? promoteCallouts(block.children)
      : block.children

    const next = { ...block, children }

    if (next.type !== 'quote') {
      return next as T
    }

    const content = next.content

    if (!Array.isArray(content) || content.length === 0) {
      return next as T
    }

    const first = content[0] as { type?: string; text?: string }

    if (first?.type !== 'text' || typeof first.text !== 'string') {
      return next as T
    }

    const hasMarker = first.text.startsWith(calloutMarker)
    const withoutMarker = hasMarker ? first.text.slice(1) : first.text
    const hasEmoji = emojiPrefixPattern.test(withoutMarker)

    if (!hasMarker && !hasEmoji) {
      return next as T
    }

    const text = withoutMarker.replace(emojiPrefixPattern, '')

    return {
      ...next,
      type: 'callout',
      content: [{ ...first, text }, ...content.slice(1)],
    } as T
  })
}

const safeProtocols = new Set(['http:', 'https:', 'mailto:'])

const schemePattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):/

const controlCharsPattern = new RegExp('[\\u0000-\\u0020]', 'g')

const urlPropNames = new Set([
  'url',
  'href',
  'src',
  'previewUrl',
  'backgroundImage',
])

const strippableElements =
  'script|style|iframe|object|embed|noscript|template|svg|math|frame|frameset|applet'

const strippableTags = `${strippableElements}|link|meta|base|form|input|button|textarea|select|option`

const fencePattern = /^\s{0,3}(`{3,}|~{3,})/

const codeSpanPattern = /`+[^`]*`+/g

const sentinel = String.fromCharCode(0)

const placeholderOpen = `${sentinel}leaf`

const placeholderClose = `leaf${sentinel}`

const placeholderPattern = new RegExp(
  `${placeholderOpen}(\\d+)${placeholderClose}`,
  'g',
)

export function sanitizeUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return ''
  }

  const collapsed = trimmed.replace(controlCharsPattern, '')
  const scheme = schemePattern.exec(collapsed)

  if (!scheme) {
    return trimmed
  }

  return safeProtocols.has(`${scheme[1].toLowerCase()}:`) ? trimmed : ''
}

export function sanitizeBlocks<T>(value: T): T {
  return walk(value) as T
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(walk)
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, item]) => {
      if (urlPropNames.has(key) && typeof item === 'string') {
        return [key, sanitizeUrl(item)] as const
      }

      return [key, walk(item)] as const
    },
  )

  return Object.fromEntries(entries)
}

export function sanitizeMarkdown(markdown: string): string {
  return splitByCodeFences(markdown)
    .map((segment) =>
      segment.isCode ? segment.text : sanitizeProse(segment.text),
    )
    .join('\n')
}

function splitByCodeFences(markdown: string) {
  const segments: Array<{ isCode: boolean; text: string }> = []
  let fence: string | null = null
  let buffer: Array<string> = []

  function flush(isCode: boolean) {
    if (buffer.length > 0) {
      segments.push({ isCode, text: buffer.join('\n') })
      buffer = []
    }
  }

  for (const line of markdown.split('\n')) {
    const match = fencePattern.exec(line)

    if (fence === null) {
      if (match) {
        flush(false)
        fence = match[1][0]
      }

      buffer.push(line)
      continue
    }

    buffer.push(line)

    if (match && match[1][0] === fence) {
      flush(true)
      fence = null
    }
  }

  flush(fence !== null)

  return segments
}

export function sanitizeHtml(html: string): string {
  return stripUnsafeMarkup(typeof html === 'string' ? html : '')
}

function sanitizeProse(text: string): string {
  const spans: Array<string> = []

  const withPlaceholders = text.replace(codeSpanPattern, (span) => {
    spans.push(span)

    return `${placeholderOpen}${spans.length - 1}${placeholderClose}`
  })

  return stripUnsafeMarkup(withPlaceholders).replace(
    placeholderPattern,
    (_, index: string) => spans[Number(index)],
  )
}

function stripUnsafeMarkup(text: string): string {
  return text
    .replace(
      new RegExp(
        `<\\s*(${strippableElements})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
        'gi',
      ),
      '',
    )
    .replace(new RegExp(`<\\s*/?\\s*(${strippableTags})\\b[^>]*>`, 'gi'), '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(\s(?:href|src|xlink:href|formaction|action|data|poster)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (match, prefix: string, rawValue: string) => {
        const quoted = rawValue.startsWith('"') || rawValue.startsWith("'")
        const value = quoted ? rawValue.slice(1, -1) : rawValue

        return sanitizeUrl(value).length > 0 ? match : `${prefix}""`
      },
    )
}

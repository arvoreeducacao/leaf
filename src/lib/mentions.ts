export type ContentMention = Readonly<{
  key: string
  userId: string
}>

export const MAX_MENTION_KEY_LENGTH = 64

type Node = Readonly<{
  type?: unknown
  props?: Readonly<{ userId?: unknown; mentionId?: unknown }>
  content?: unknown
  children?: unknown
  rows?: unknown
  cells?: unknown
}>

function keyOf(userId: string, mentionId: unknown): string {
  const id =
    typeof mentionId === 'string' && mentionId.trim().length > 0
      ? mentionId.trim()
      : `user:${userId}`

  return id.slice(0, MAX_MENTION_KEY_LENGTH)
}

function visit(value: unknown, found: Map<string, ContentMention>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, found)
    }

    return
  }

  if (value === null || typeof value !== 'object') {
    return
  }

  const node = value as Node

  if (node.type === 'mention') {
    const userId = node.props?.userId

    if (typeof userId === 'string' && userId.length > 0) {
      const key = keyOf(userId, node.props?.mentionId)

      if (!found.has(key)) {
        found.set(key, { key, userId })
      }
    }

    return
  }

  visit(node.content, found)
  visit(node.children, found)
  visit(node.rows, found)
  visit(node.cells, found)
}

export function mentionsInContent(
  content: string | null,
): Array<ContentMention> {
  if (!content) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  const found = new Map<string, ContentMention>()

  visit(parsed, found)

  return [...found.values()]
}

export function addedMentions(
  previous: string | null,
  next: string | null,
): Array<ContentMention> {
  const before = new Set(
    mentionsInContent(previous).map((mention) => mention.key),
  )

  return mentionsInContent(next).filter((mention) => !before.has(mention.key))
}

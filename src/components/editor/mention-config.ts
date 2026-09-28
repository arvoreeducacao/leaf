export const mentionConfig = {
  type: 'mention' as const,
  propSchema: {
    userId: { default: '' },
    name: { default: '' },
    mentionId: { default: '' },
  },
  content: 'none' as const,
}

export const mentionClassName = 'leaf-mention'

export function mentionLabel(name: string): string {
  const trimmed = name.trim()

  return `@${trimmed.length > 0 ? trimmed : '?'}`
}

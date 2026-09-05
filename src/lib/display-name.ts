export const MAX_DISPLAY_NAME_LENGTH = 80

export function normalizeDisplayName(value: string): string | null {
  const collapsed = value.replace(/\s+/gu, ' ').trim()

  if (collapsed.length === 0) {
    return null
  }

  return collapsed.slice(0, MAX_DISPLAY_NAME_LENGTH)
}

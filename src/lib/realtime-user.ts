export type RealtimeTheme = 'light' | 'dark'

export const realtimeCursorColors = {
  light: [
    '#266e64',
    '#315bc1',
    '#653acd',
    '#952900',
    '#81001e',
    '#456c18',
    '#235439',
    '#053b4b',
  ],
  dark: [
    '#adece5',
    '#b3caf9',
    '#c8b9ee',
    '#fdc3b1',
    '#fc98ab',
    '#c7ec99',
    '#90dcb4',
    '#d5e4e7',
  ],
} as const

export const realtimeTextColors = {
  light: '#ffffff',
  dark: '#02212a',
} as const

export function realtimeColorIndex(userId: string) {
  let hash = 0

  for (const codePoint of userId) {
    hash = (hash * 31 + (codePoint.codePointAt(0) ?? 0)) % 2_147_483_647
  }

  return hash % realtimeCursorColors.light.length
}

export function realtimeColorFor(userId: string, theme: RealtimeTheme) {
  return realtimeCursorColors[theme][realtimeColorIndex(userId)]
}

export function realtimeTextColorFor(color: string) {
  return realtimeCursorColors.dark.includes(
    color as (typeof realtimeCursorColors.dark)[number],
  )
    ? realtimeTextColors.dark
    : realtimeTextColors.light
}

export function realtimeInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return '?'
  }

  const first = [...parts[0]][0] ?? ''
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : ''

  return `${first}${last}`.toLocaleUpperCase()
}

export type RealtimePeer = Readonly<{
  clientId: number
  userId: string | null
  name: string
  image: string | null
  isSelf: boolean
}>

type AwarenessUserState = Readonly<{
  id?: unknown
  name?: unknown
  image?: unknown
}>

export function peersFromAwareness(
  states: ReadonlyMap<number, Record<string, unknown>>,
  localClientId: number,
  fallbackName: string,
): Array<RealtimePeer> {
  const peers: Array<RealtimePeer> = []

  for (const [clientId, state] of states) {
    const user = state.user as AwarenessUserState | undefined

    if (!user) {
      continue
    }

    const userId = typeof user.id === 'string' ? user.id : null
    const name =
      typeof user.name === 'string' && user.name.trim().length > 0
        ? user.name.trim()
        : fallbackName

    peers.push({
      clientId,
      userId,
      name,
      image: typeof user.image === 'string' ? user.image : null,
      isSelf: clientId === localClientId,
    })
  }

  return peers.sort((left, right) => left.clientId - right.clientId)
}

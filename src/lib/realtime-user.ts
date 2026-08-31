export const realtimeCursorColors = [
  '#309385',
  '#3a6de4',
  '#744cd2',
  '#c73c0c',
  '#c7002a',
  '#5d911c',
  '#307950',
  '#154b5a',
] as const

export function realtimeColorFor(userId: string) {
  let hash = 0

  for (const codePoint of userId) {
    hash = (hash * 31 + (codePoint.codePointAt(0) ?? 0)) % 2_147_483_647
  }

  return realtimeCursorColors[hash % realtimeCursorColors.length]
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
  color: string
  isSelf: boolean
}>

type AwarenessUserState = Readonly<{
  id?: unknown
  name?: unknown
  color?: unknown
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
    const name = typeof user.name === 'string' && user.name.trim().length > 0
      ? user.name.trim()
      : fallbackName

    peers.push({
      clientId,
      userId,
      name,
      color:
        typeof user.color === 'string' && user.color.length > 0
          ? user.color
          : realtimeColorFor(userId ?? String(clientId)),
      isSelf: clientId === localClientId,
    })
  }

  return peers.sort((left, right) => left.clientId - right.clientId)
}

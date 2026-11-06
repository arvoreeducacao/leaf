export const realtimeRoomPrefix = 'doc:'
export const realtimeFragmentName = 'prosemirror'
export const realtimeSyncTimeoutMs = 2_500
export const realtimeDefaultPort = 1234
export const realtimeDevSecret = 'leaf-dev-realtime'
export const realtimeSecretHeader = 'x-leaf-realtime-secret'

const documentIdPattern = /^[A-Za-z0-9_-]{1,64}$/

export function realtimeRoomName(documentId: string) {
  return `${realtimeRoomPrefix}${documentId}`
}

export function documentIdFromRoom(room: string): string | null {
  if (!room.startsWith(realtimeRoomPrefix)) {
    return null
  }

  const documentId = room.slice(realtimeRoomPrefix.length)

  return documentIdPattern.test(documentId) ? documentId : null
}

export function isDocumentIdShaped(value: unknown): value is string {
  return typeof value === 'string' && documentIdPattern.test(value)
}

export type RealtimeCloseCode =
  | 4100
  | 4403
  | 4404
  | 4405
  | 4409
  | 4410
  | 4500

export const realtimeCloseCodes = {
  accessChanged: 4100,
  forbidden: 4403,
  notFound: 4404,
  trashed: 4405,
  unreadable: 4409,
  identityChanged: 4410,
  unavailable: 4500,
} as const satisfies Record<string, RealtimeCloseCode>

export const realtimeGivesUpFrom = 4400
export const realtimeGivesUpUntil = 4500

export function realtimeCloseIsFinal(code: number) {
  return code >= realtimeGivesUpFrom && code < realtimeGivesUpUntil
}

export type RealtimeConnection =
  | 'connected'
  | 'reconnecting'
  | 'lost'
  | 'offline'

export function realtimeConnectionFrom(
  provider: Readonly<{
    online: boolean
    connected: boolean
    synced: boolean
    stillTrying: boolean
  }>,
) {
  if (!provider.online) {
    return 'offline'
  }

  if (!provider.stillTrying) {
    return 'lost'
  }

  return provider.connected && provider.synced ? 'connected' : 'reconnecting'
}

export type ConnectionNotice = 'none' | 'offline' | 'lost' | 'reconnecting'

export const reconnectingNoticeDelayMs = 3_000
export const lostNoticeDelayMs = 30_000

export function connectionNoticeFor(
  state: Readonly<{
    online: boolean
    connection: RealtimeConnection | 'solo'
    reconnectingForMs: number
  }>,
): ConnectionNotice {
  if (!state.online || state.connection === 'offline') {
    return 'offline'
  }

  if (state.connection === 'lost') {
    return 'lost'
  }

  if (state.connection !== 'reconnecting') {
    return 'none'
  }

  if (state.reconnectingForMs >= lostNoticeDelayMs) {
    return 'lost'
  }

  return state.reconnectingForMs >= reconnectingNoticeDelayMs
    ? 'reconnecting'
    : 'none'
}

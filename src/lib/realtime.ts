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

export type RealtimeCloseCode = 4403 | 4404 | 4409 | 4500

export const realtimeCloseCodes = {
  forbidden: 4403,
  notFound: 4404,
  unreadable: 4409,
  unavailable: 4500,
} as const satisfies Record<string, RealtimeCloseCode>

export const realtimeGivesUpFrom = 4400
export const realtimeGivesUpUntil = 4500

export function realtimeCloseIsFinal(code: number) {
  return code >= realtimeGivesUpFrom && code < realtimeGivesUpUntil
}

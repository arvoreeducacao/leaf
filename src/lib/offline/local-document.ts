import type { OfflineStore } from './store'

export const localDocumentPrefix = 'doc:'

export type LocalDocumentMeta = Readonly<{
  identity: string | null
  serverUpdatedAt: number | null
}>

export type ServerSnapshot = Readonly<{
  content: string | null
  identity: string | null
  updatedAt: number
  canEdit: boolean
}>

export type LocalStartInput = Readonly<{
  mode: 'realtime' | 'solo'
  hasLocalState: boolean
  hasPendingEdits: boolean
  local: LocalDocumentMeta | null
  server: ServerSnapshot | null
}>

export type LocalStartDecision = Readonly<{
  action: 'connect' | 'reset-and-connect' | 'seed' | 'reset-and-seed' | 'local-only' | 'unavailable'
  conflict: boolean
}>

function decision(
  action: LocalStartDecision['action'],
  conflict = false,
): LocalStartDecision {
  return { action, conflict }
}

export function localDocumentKey(documentId: string) {
  return `${localDocumentPrefix}${documentId}`
}

export async function readLocalDocumentMeta(
  store: OfflineStore,
  documentId: string,
) {
  return store.get<LocalDocumentMeta>(localDocumentKey(documentId))
}

export async function writeLocalDocumentMeta(
  store: OfflineStore,
  documentId: string,
  meta: LocalDocumentMeta,
) {
  await store.set(localDocumentKey(documentId), meta)
}

export function decideLocalStart({
  mode,
  hasLocalState,
  hasPendingEdits,
  local,
  server,
}: LocalStartInput): LocalStartDecision {
  if (server === null) {
    return hasLocalState ? decision('local-only') : decision('unavailable')
  }

  if (mode === 'realtime') {
    const identityChanged =
      hasLocalState &&
      local?.identity != null &&
      server.identity != null &&
      local.identity !== server.identity

    return identityChanged
      ? decision('reset-and-connect', hasPendingEdits)
      : decision('connect')
  }

  if (!hasLocalState) {
    return decision('seed')
  }

  const serverMoved = server.updatedAt > (local?.serverUpdatedAt ?? 0)

  if (!serverMoved) {
    return decision('local-only')
  }

  return hasPendingEdits
    ? decision('local-only', true)
    : decision('reset-and-seed')
}

'use client'

import { realtimeRoomPrefix } from '@/lib/realtime'

import { offlineDatabaseName } from './store'

function deleteDatabase(name: string) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name)

    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

async function offlineDatabaseNames() {
  if (typeof indexedDB.databases !== 'function') {
    return [offlineDatabaseName]
  }

  const databases = await indexedDB.databases().catch(() => [])

  return databases
    .map((database) => database.name ?? '')
    .filter(
      (name) =>
        name === offlineDatabaseName || name.startsWith(realtimeRoomPrefix),
    )
}

export async function wipeOfflineData() {
  if (typeof indexedDB === 'undefined') {
    return
  }

  for (const name of await offlineDatabaseNames()) {
    await deleteDatabase(name)
  }
}

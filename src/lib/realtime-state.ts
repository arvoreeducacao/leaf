import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documentRealtimeState } from '@/db/schema'

export type StoredRealtimeState = Readonly<{
  identity: string
  state: Uint8Array
  updatedAt: Date
}>

export async function readRealtimeState(
  documentId: string,
): Promise<StoredRealtimeState | null> {
  const row = await db.query.documentRealtimeState.findFirst({
    where: eq(documentRealtimeState.documentId, documentId),
  })

  if (!row) {
    return null
  }

  return {
    identity: row.identity,
    state: new Uint8Array(row.state),
    updatedAt: new Date(row.updatedAt),
  }
}

export async function readRealtimeIdentity(documentId: string) {
  const row = await db.query.documentRealtimeState.findFirst({
    where: eq(documentRealtimeState.documentId, documentId),
    columns: { identity: true },
  })

  return row?.identity ?? null
}

export async function writeRealtimeState(
  documentId: string,
  state: Uint8Array,
  identity: string,
) {
  const updatedAt = new Date()

  await db
    .insert(documentRealtimeState)
    .values({ documentId, identity, state, updatedAt })
    .onDuplicateKeyUpdate({
      set: { state, updatedAt },
    })
}

export function isRealtimeStateStale(
  stateUpdatedAt: Date,
  documentUpdatedAt: Date,
) {
  return stateUpdatedAt.getTime() < documentUpdatedAt.getTime()
}

export function newRealtimeIdentity() {
  return nanoid(16)
}

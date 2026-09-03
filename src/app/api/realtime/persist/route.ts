import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { user } from '@/db/schema'
import { persistDocumentContent } from '@/lib/document-content'
import { isDocumentIdShaped } from '@/lib/realtime'
import { hasValidRealtimeSecret, isRealtimeEnabled } from '@/lib/realtime-config'
import { contentFromRealtimeState } from '@/lib/realtime-document'
import {
  newRealtimeIdentity,
  readRealtimeIdentity,
  writeRealtimeState,
} from '@/lib/realtime-state'

const maxStateBytes = 4_000_000

async function knownAuthorId(candidate: unknown) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return null
  }

  const author = await db.query.user.findFirst({
    where: eq(user.id, candidate),
  })

  return author ? author.id : null
}

export async function POST(request: Request) {
  if (!isRealtimeEnabled() || !hasValidRealtimeSecret(request)) {
    return Response.json({ error: 'not-found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as {
    documentId?: unknown
    state?: unknown
    authorId?: unknown
  } | null

  if (
    !body ||
    !isDocumentIdShaped(body.documentId) ||
    typeof body.state !== 'string'
  ) {
    return Response.json({ error: 'bad-request' }, { status: 400 })
  }

  const state = Buffer.from(body.state, 'base64')

  if (state.byteLength === 0 || state.byteLength > maxStateBytes) {
    return Response.json({ error: 'bad-request' }, { status: 400 })
  }

  const content = contentFromRealtimeState(new Uint8Array(state))

  if (content === null) {
    return Response.json({ error: 'unreadable' }, { status: 422 })
  }

  const authorId = await knownAuthorId(body.authorId)
  const written = await persistDocumentContent(
    body.documentId,
    content,
    authorId,
  )
  const identity =
    (await readRealtimeIdentity(body.documentId)) ?? newRealtimeIdentity()

  await writeRealtimeState(body.documentId, new Uint8Array(state), identity)

  if (written) {
    revalidatePath('/', 'layout')
    revalidatePath(`/doc/${body.documentId}`)
  }

  return Response.json({ ok: true, written })
}

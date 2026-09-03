import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import {
  destinationOfParent,
  parseImportDestination,
  resolveImportPlacement,
  serializeImportDestination,
} from '@/lib/import-destination'
import { createNotionClient } from '@/lib/notion/api'
import { getNotionConnection } from '@/lib/notion/connection'
import { assetKeyFor } from '@/lib/notion/import'
import type { ImportEvent } from '@/lib/notion/import'
import { notionIdFromLink } from '@/lib/notion/link'
import { buildNotionImportMessages } from '@/lib/notion/messages'
import { syncNotion } from '@/lib/notion/sync'
import { storage } from '@/lib/storage'

export const runtime = 'nodejs'

export const maxDuration = 3600

export async function POST(request: Request) {
  const t = await getTranslations('archiveImport')
  const messages = buildNotionImportMessages(
    t,
    (await getTranslations('document'))('untitled'),
  )

  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: t('notAuthenticated') }, { status: 401 })
  }

  const payload: unknown = await request.json().catch(() => null)
  const body = (payload ?? {}) as Record<string, unknown>
  const wholeWorkspace = body.workspace === true
  const pageId = wholeWorkspace
    ? null
    : notionIdFromLink(String(body.link ?? ''))

  if (!wholeWorkspace && !pageId) {
    return NextResponse.json({ error: t('invalidLink') }, { status: 400 })
  }

  const connection = await getNotionConnection(session.user.id)

  if (!connection) {
    return NextResponse.json({ error: t('notConnected') }, { status: 412 })
  }

  const parentId =
    typeof body.parentId === 'string' && body.parentId.length > 0
      ? body.parentId
      : null

  if (parentId && (await getDocumentAccess(parentId, session)) !== 'owner') {
    return NextResponse.json(
      { error: (await getTranslations('errors'))('notAllowed') },
      { status: 403 },
    )
  }

  const parent = parentId ? await getDocument(parentId) : null
  const destination =
    parseImportDestination(body.destination) ?? destinationOfParent(parent)
  const placement = await resolveImportPlacement(destination, session.user.id)

  if (!placement) {
    return NextResponse.json(
      { error: (await getTranslations('errors'))('notAllowed') },
      { status: 403 },
    )
  }

  const staysUnderParent =
    serializeImportDestination(destination) ===
    serializeImportDestination(destinationOfParent(parent))

  const owner = {
    id: session.user.id,
    orgAccess: placement.orgAccess,
    orgId: placement.orgId,
    parentId: staysUnderParent ? parentId : null,
    teamspaceId: placement.teamspaceId,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: ImportEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        const client = createNotionClient(connection.accessToken, {
          signal: request.signal,
        })

        for await (const event of syncNotion(
          client,
          wholeWorkspace
            ? 'workspace'
            : [{ id: pageId as string, kind: 'page' }],
          owner,
          messages,
          request.signal,
          {
            comments: body.comments === true,
            force: body.force === true,
            storeAsset: async (bytes, contentType, fileName) => {
              const key = assetKeyFor(fileName)

              await storage.put(key, Buffer.from(bytes), contentType)

              return `/api/uploads/${key}`
            },
          },
        )) {
          send(event)

          if (event.type === 'done') {
            revalidatePath('/', 'layout')
          }
        }
      } catch {
        send({ type: 'error', error: t('unfinished') })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  })
}


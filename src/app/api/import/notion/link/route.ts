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
import { crawlNotionPage, crawlNotionWorkspace } from '@/lib/notion/crawl'
import { assetKeyFor, importNotionPlan } from '@/lib/notion/import'
import { storage } from '@/lib/storage'
import type { ImportEvent } from '@/lib/notion/import'
import { notionIdFromLink } from '@/lib/notion/link'
import { buildNotionImportMessages } from '@/lib/notion/messages'

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

        const crawlOptions = {
          assetSink: async (asset: {
            path: string
            bytes: Uint8Array
            contentType: string
          }) => {
            const key = assetKeyFor(asset.path)

            await storage.put(key, Buffer.from(asset.bytes), asset.contentType)

            return `/api/uploads/${key}`
          },
          comments: body.comments === true,
        }

        const crawl = wholeWorkspace
          ? crawlNotionWorkspace(client, messages, request.signal, crawlOptions)
          : crawlNotionPage(
              client,
              pageId as string,
              messages,
              request.signal,
              crawlOptions,
            )

        for await (const event of crawl) {
          if (event.type === 'page') {
            send({
              done: event.done,
              label: event.title,
              phase: 'reading',
              total: 0,
              type: 'progress',
            })

            continue
          }

          for await (const step of importNotionPlan(
            event.plan,
            owner,
            messages,
            request.signal,
            event.comments,
          )) {
            if (step.type === 'done') {
              send({
                summary: {
                  ...step.summary,
                  warnings: [...event.warnings, ...step.summary.warnings],
                },
                type: 'done',
              })
              revalidatePath('/', 'layout')

              continue
            }

            send(step)
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

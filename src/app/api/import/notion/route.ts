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
import { importNotionZip } from '@/lib/notion/import'
import { MAX_ZIP_BYTES, MAX_ZIP_LABEL, ZIP_EXTENSIONS } from '@/lib/notion/limits'
import { buildNotionImportMessages } from '@/lib/notion/messages'
import {
  importEventStream,
  importStreamHeaders,
} from '@/lib/notion/stream'

export const runtime = 'nodejs'

export const maxDuration = 300

export async function POST(request: Request) {
  const t = await getTranslations('archiveImport')
  const messages = buildNotionImportMessages(
    t,
    (await getTranslations('document'))('untitled'),
  )

  function tooLarge() {
    return NextResponse.json(
      { error: t('tooLargeZip', { limit: MAX_ZIP_LABEL }) },
      { status: 413 },
    )
  }

  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { error: t('notAuthenticated') },
      { status: 401 },
    )
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')

  if (declaredLength > MAX_ZIP_BYTES * 1.1) {
    return tooLarge()
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: t('missingFile') },
      { status: 400 },
    )
  }

  const name = file.name.toLowerCase()

  if (!ZIP_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return NextResponse.json(
      { error: t('wrongExtension') },
      { status: 415 },
    )
  }

  if (file.size > MAX_ZIP_BYTES) {
    return tooLarge()
  }

  const requestedParent = formData.get('parentId')
  const parentId =
    typeof requestedParent === 'string' && requestedParent.length > 0
      ? requestedParent
      : null

  if (
    parentId &&
    (await getDocumentAccess(parentId, session)) !== 'owner'
  ) {
    return NextResponse.json(
      { error: (await getTranslations('errors'))('notAllowed') },
      { status: 403 },
    )
  }

  const parent = parentId ? await getDocument(parentId) : null
  const destination =
    parseImportDestination(formData.get('destination')) ??
    destinationOfParent(parent)
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

  const data = new Uint8Array(await file.arrayBuffer())
  const owner = {
    id: session.user.id,
    orgAccess: placement.orgAccess,
    orgId: placement.orgId,
    parentId: staysUnderParent ? parentId : null,
    teamspaceId: placement.teamspaceId,
  }

  const stream = importEventStream(
    importNotionZip(data, owner, messages, request.signal),
    {
      failure: t('unfinished'),
      onDone: () => revalidatePath('/', 'layout'),
    },
  )

  return new Response(stream, { headers: importStreamHeaders })
}

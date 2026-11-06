import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documentVersions, documents, user } from '@/db/schema'
import { authorNameOf } from '@/lib/author-name'
import { parseContentBlocks } from '@/lib/markdown/convert'
import { writeBlocksToLiveRoom } from '@/lib/realtime-room'
import {
  MAX_VERSIONS_PER_DOCUMENT,
  VERSION_THROTTLE_MS,
} from '@/lib/version-limits'

export { MAX_VERSIONS_PER_DOCUMENT, VERSION_THROTTLE_MS }

export type VersionSummary = Readonly<{
  id: string
  title: string
  authorId: string | null
  authorName: string | null
  createdAt: number
}>

export type VersionDetail = VersionSummary &
  Readonly<{ content: string | null }>

export type AppliedVersion =
  | Readonly<{ status: 'applied'; version: VersionDetail }>
  | Readonly<{ status: 'not-found' }>
  | Readonly<{ status: 'room-unreachable' }>

type VersionSnapshot = Readonly<{ title: string; content: string | null }>

type RecordOptions = Readonly<{
  force?: boolean
  now?: Date
  snapshot?: VersionSnapshot
}>

function authorFilter(authorId: string | null) {
  return authorId === null
    ? isNull(documentVersions.authorId)
    : eq(documentVersions.authorId, authorId)
}

async function latestVersion(documentId: string) {
  const rows = await db
    .select({
      id: documentVersions.id,
      content: documentVersions.content,
      createdAt: documentVersions.createdAt,
      title: documentVersions.title,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt), desc(documentVersions.id))
    .limit(1)

  return rows[0] ?? null
}

async function latestVersionByAuthor(
  documentId: string,
  authorId: string | null,
) {
  const rows = await db
    .select({ createdAt: documentVersions.createdAt })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        authorFilter(authorId),
      ),
    )
    .orderBy(desc(documentVersions.createdAt))
    .limit(1)

  return rows[0] ?? null
}

export async function pruneDocumentVersions(documentId: string) {
  const rows = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt), desc(documentVersions.id))

  const stale = rows.slice(MAX_VERSIONS_PER_DOCUMENT).map((row) => row.id)

  if (stale.length === 0) {
    return 0
  }

  await db
    .delete(documentVersions)
    .where(inArray(documentVersions.id, stale))

  return stale.length
}

export async function recordDocumentVersion(
  documentId: string,
  authorId: string | null,
  options: RecordOptions = {},
): Promise<boolean> {
  const now = options.now ?? new Date()

  if (!options.force) {
    const previous = await latestVersionByAuthor(documentId, authorId)

    if (
      previous &&
      now.getTime() - previous.createdAt.getTime() < VERSION_THROTTLE_MS
    ) {
      return false
    }
  }

  const document =
    options.snapshot ??
    (await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    }))

  if (!document) {
    return false
  }

  const newest = await latestVersion(documentId)

  if (
    newest &&
    newest.content === document.content &&
    newest.title === document.title
  ) {
    return false
  }

  await db.insert(documentVersions).values({
    id: nanoid(12),
    documentId,
    title: document.title,
    content: document.content,
    authorId,
    createdAt: now,
  })

  await pruneDocumentVersions(documentId)

  return true
}

export async function listDocumentVersions(
  documentId: string,
): Promise<Array<VersionSummary>> {
  const rows = await db
    .select({
      id: documentVersions.id,
      title: documentVersions.title,
      authorId: documentVersions.authorId,
      authorName: user.name,
      authorEmail: user.email,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .leftJoin(user, eq(user.id, documentVersions.authorId))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt), desc(documentVersions.id))

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    authorId: row.authorId,
    authorName: authorNameOf(row.authorName, row.authorEmail),
    createdAt: row.createdAt.getTime(),
  }))
}

export async function getDocumentVersion(
  documentId: string,
  versionId: string,
): Promise<VersionDetail | null> {
  const rows = await db
    .select({
      id: documentVersions.id,
      title: documentVersions.title,
      content: documentVersions.content,
      authorId: documentVersions.authorId,
      authorName: user.name,
      authorEmail: user.email,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .leftJoin(user, eq(user.id, documentVersions.authorId))
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.documentId, documentId),
      ),
    )
    .limit(1)

  const row = rows[0]

  if (!row) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.authorId,
    authorName: authorNameOf(row.authorName, row.authorEmail),
    createdAt: row.createdAt.getTime(),
  }
}

export async function applyDocumentVersion(
  documentId: string,
  versionId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<AppliedVersion> {
  const version = await getDocumentVersion(documentId, versionId)

  if (!version) {
    return { status: 'not-found' }
  }

  const current = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  })

  if (
    current?.content === version.content &&
    current?.title === version.title
  ) {
    return { status: 'applied', version }
  }

  const live =
    current?.content === version.content
      ? 'disabled'
      : await writeBlocksToLiveRoom(
          documentId,
          parseContentBlocks(version.content),
          'replace',
          actorId,
        )

  if (live === 'unreachable' || live === 'misconfigured') {
    return { status: 'room-unreachable' }
  }

  await recordDocumentVersion(documentId, actorId, {
    force: true,
    now,
    ...(current ? { snapshot: current } : {}),
  })

  await db
    .update(documents)
    .set(
      live === 'applied'
        ? { title: version.title, updatedAt: now }
        : { content: version.content, title: version.title, updatedAt: now },
    )
    .where(eq(documents.id, documentId))

  return { status: 'applied', version }
}

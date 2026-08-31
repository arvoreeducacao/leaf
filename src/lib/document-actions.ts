'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { getActiveMembership } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import {
  canEdit,
  getDocumentAccess,
  getTrashedDocumentAccess,
} from '@/lib/authz'
import { recordDocumentVersion } from '@/lib/document-versions'
import { listOwnedDocuments, listSubtreeIds } from '@/lib/documents'
import { indexDocument, removeDocumentFromIndex } from '@/lib/search-index'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function errorMessages() {
  return getTranslations('errors')
}

async function notAllowedResult(): Promise<{ ok: false; error: string }> {
  const t = await errorMessages()

  return { ok: false, error: t('notAllowed') }
}

async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

export async function createDocument() {
  const session = await requireSession()
  const id = nanoid(12)
  const now = new Date()
  const membership = await getActiveMembership(session.user.id)

  await db.insert(documents).values({
    id,
    ownerId: session.user.id,
    orgId: membership?.orgId ?? null,
    title: (await getTranslations('document'))('untitled'),
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/', 'layout')
  redirect(`/doc/${id}`)
}

export async function renameDocument(
  id: string,
  title: string,
): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (!canEdit(access)) {
    return notAllowedResult()
  }

  const trimmed = title.trim().slice(0, 200)

  await db
    .update(documents)
    .set({
      title:
        trimmed.length > 0
          ? trimmed
          : (await getTranslations('document'))('untitled'),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))

  indexDocument(id)

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${id}`)

  return { ok: true }
}

export async function updateDocumentContent(
  id: string,
  contentJSON: string,
): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (!canEdit(access)) {
    return notAllowedResult()
  }

  const current = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  if (current?.content === contentJSON) {
    return { ok: true }
  }

  await db
    .update(documents)
    .set({ content: contentJSON, updatedAt: new Date() })
    .where(eq(documents.id, id))

  await recordDocumentVersion(id, session.user.id)
  indexDocument(id)

  return { ok: true }
}

export type DuplicateResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function duplicateDocument(
  id: string,
): Promise<DuplicateResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  const source = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), isNull(documents.deletedAt)),
  })

  if (!source) {
    return { ok: false, error: (await errorMessages())('documentNotFound') }
  }

  const copyId = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id: copyId,
    ownerId: session.user.id,
    parentId: source.parentId,
    orgId: source.orgId,
    teamspaceId: source.teamspaceId,
    title: (await getTranslations('document'))('copyTitle', {
      title: source.title,
    }).slice(0, 200),
    content: source.content,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/', 'layout')

  return { ok: true, id: copyId }
}

export type MoveTarget = Readonly<{
  id: string
  title: string
  path: string
}>

export type MoveTargetsResult =
  | { ok: true; targets: Array<MoveTarget>; currentParentId: string | null }
  | { ok: false; error: string }

export async function listMoveTargets(
  documentId: string,
): Promise<MoveTargetsResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(documentId, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  const owned = await listOwnedDocuments(session.user.id)
  const blocked = new Set(await listSubtreeIds(documentId, session.user.id))
  const byId = new Map(owned.map((item) => [item.id, item]))

  function pathOf(id: string): string {
    const titles: Array<string> = []
    const seen = new Set<string>()
    let current = byId.get(id)

    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      titles.unshift(current.title)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }

    return titles.join(' / ')
  }

  const targets = owned
    .filter((item) => !blocked.has(item.id))
    .map((item) => ({ id: item.id, title: item.title, path: pathOf(item.id) }))
    .sort((left, right) => left.path.localeCompare(right.path, 'pt-BR'))

  return {
    ok: true,
    targets,
    currentParentId: byId.get(documentId)?.parentId ?? null,
  }
}

export async function moveDocument(
  id: string,
  parentId: string | null,
): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  if (parentId === id) {
    return { ok: false, error: (await errorMessages())('selfParent') }
  }

  if (parentId) {
    const targetAccess = await getDocumentAccess(parentId, session)

    if (targetAccess !== 'owner') {
      return notAllowedResult()
    }

    const subtree = await listSubtreeIds(id, session.user.id)

    if (subtree.includes(parentId)) {
      return { ok: false, error: (await errorMessages())('descendantParent') }
    }
  }

  await db
    .update(documents)
    .set({ parentId, updatedAt: new Date() })
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  if (parentId) {
    const parent = await db.query.documents.findFirst({
      where: eq(documents.id, parentId),
    })

    if (parent) {
      const subtree = await listSubtreeIds(id, session.user.id)

      await db
        .update(documents)
        .set({ teamspaceId: parent.teamspaceId, orgId: parent.orgId })
        .where(inArray(documents.id, subtree))
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${id}`)

  return { ok: true }
}

export async function moveToTrash(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  const subtree = await listSubtreeIds(id, session.user.id)

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(inArray(documents.id, subtree), isNull(documents.deletedAt)))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function restoreDocument(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getTrashedDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  if (!document) {
    return notAllowedResult()
  }

  const subtree = await listSubtreeIds(id, session.user.id)
  const now = new Date()

  if (document.parentId) {
    const parent = await db.query.documents.findFirst({
      where: eq(documents.id, document.parentId),
    })

    if (!parent || parent.deletedAt) {
      await db
        .update(documents)
        .set({ parentId: null })
        .where(eq(documents.id, id))
    }
  }

  await db
    .update(documents)
    .set({ deletedAt: null, updatedAt: now })
    .where(inArray(documents.id, subtree))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function deleteForever(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getTrashedDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowedResult()
  }

  const subtree = await listSubtreeIds(id, session.user.id)

  await db
    .update(documents)
    .set({ parentId: null })
    .where(inArray(documents.id, subtree))

  await db.delete(documents).where(inArray(documents.id, subtree))

  for (const documentId of subtree) {
    removeDocumentFromIndex(documentId)
  }

  revalidatePath('/', 'layout')

  return { ok: true }
}

'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { getSession } from '@/lib/auth'
import {
  canEdit,
  getDocumentAccess,
  getTrashedDocumentAccess,
} from '@/lib/authz'
import { listOwnedDocuments, listSubtreeIds } from '@/lib/documents'

export type ActionResult = { ok: true } | { ok: false; error: string }

const notAllowedMessage = 'Você não tem permissão para esta ação.'

const notAllowed: ActionResult = { ok: false, error: notAllowedMessage }

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

  await db.insert(documents).values({
    id,
    ownerId: session.user.id,
    title: 'Sem título',
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
    return notAllowed
  }

  const trimmed = title.trim().slice(0, 200)

  await db
    .update(documents)
    .set({ title: trimmed.length > 0 ? trimmed : 'Sem título', updatedAt: new Date() })
    .where(eq(documents.id, id))

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
    return notAllowed
  }

  await db
    .update(documents)
    .set({ content: contentJSON, updatedAt: new Date() })
    .where(eq(documents.id, id))

  return { ok: true }
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
    return { ok: false, error: notAllowedMessage }
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
    return notAllowed
  }

  if (parentId === id) {
    return { ok: false, error: 'Um documento não pode ficar dentro de si mesmo.' }
  }

  if (parentId) {
    const targetAccess = await getDocumentAccess(parentId, session)

    if (targetAccess !== 'owner') {
      return notAllowed
    }

    const subtree = await listSubtreeIds(id, session.user.id)

    if (subtree.includes(parentId)) {
      return {
        ok: false,
        error: 'Não dá para mover um documento para dentro de uma subpágina dele.',
      }
    }
  }

  await db
    .update(documents)
    .set({ parentId, updatedAt: new Date() })
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${id}`)

  return { ok: true }
}

export async function moveToTrash(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowed
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
    return notAllowed
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  if (!document) {
    return notAllowed
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
    return notAllowed
  }

  const subtree = await listSubtreeIds(id, session.user.id)

  await db
    .update(documents)
    .set({ parentId: null })
    .where(inArray(documents.id, subtree))

  await db.delete(documents).where(inArray(documents.id, subtree))

  revalidatePath('/', 'layout')

  return { ok: true }
}

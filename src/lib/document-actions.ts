'use server'

import { and, eq, isNull } from 'drizzle-orm'
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

export type ActionResult = { ok: true } | { ok: false; error: string }

const notAllowed: ActionResult = {
  ok: false,
  error: 'Você não tem permissão para esta ação.',
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

export async function moveToTrash(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowed
  }

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function restoreDocument(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getTrashedDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowed
  }

  await db
    .update(documents)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(documents.id, id))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function deleteForever(id: string): Promise<ActionResult> {
  const session = await requireSession()
  const access = await getTrashedDocumentAccess(id, session)

  if (access !== 'owner') {
    return notAllowed
  }

  await db.delete(documents).where(eq(documents.id, id))

  revalidatePath('/', 'layout')

  return { ok: true }
}

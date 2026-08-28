'use server'

import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { documentShares, documents, user } from '@/db/schema'
import type { ShareRole } from '@/db/schema'
import { getSession } from '@/lib/auth'
import type { AccessLevel } from '@/lib/authz'
import { canManageShares, getDocumentAccess } from '@/lib/authz'

export type SharePerson = Readonly<{
  id: string
  email: string
  role: ShareRole
}>

export type ShareState = Readonly<{
  role: AccessLevel
  ownerEmail: string
  ownerName: string
  people: ReadonlyArray<SharePerson>
  publicToken: string | null
}>

export type ShareResult =
  | { ok: true; state: ShareState }
  | { ok: false; error: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const maxEmailLength = 254
const publicTokenLength = 24

const messages = {
  denied: 'Você não tem permissão para esta ação.',
  notFound: 'Documento não encontrado.',
  signedOut: 'Faça login para continuar.',
  invalidEmail: 'Digite um email válido.',
  ownerEmail: 'Este email já é o dono do documento.',
  invalidRole: 'Escolha um papel válido.',
  shareNotFound: 'Este convite não existe mais.',
}

function denied(): ShareResult {
  return { ok: false, error: messages.denied }
}

function isShareRole(value: string): value is ShareRole {
  return value === 'viewer' || value === 'editor'
}

async function readState(
  documentId: string,
  role: AccessLevel,
): Promise<ShareResult> {
  const rows = await db
    .select({
      publicToken: documents.publicToken,
      ownerEmail: user.email,
      ownerName: user.name,
    })
    .from(documents)
    .innerJoin(user, eq(user.id, documents.ownerId))
    .where(eq(documents.id, documentId))
    .limit(1)

  const row = rows[0]

  if (!row) {
    return { ok: false, error: messages.notFound }
  }

  const people = await db
    .select({
      id: documentShares.id,
      email: documentShares.granteeEmail,
      role: documentShares.role,
    })
    .from(documentShares)
    .where(eq(documentShares.documentId, documentId))
    .orderBy(asc(documentShares.createdAt))

  return {
    ok: true,
    state: {
      role,
      ownerEmail: row.ownerEmail,
      ownerName: row.ownerName,
      people,
      publicToken: role === 'owner' ? row.publicToken : null,
    },
  }
}

async function resolveAccess(documentId: string) {
  const session = await getSession()

  if (!session) {
    return { session: null, access: null }
  }

  const access = await getDocumentAccess(documentId, session)

  return { session, access }
}

export async function loadShareState(documentId: string): Promise<ShareResult> {
  const { session, access } = await resolveAccess(documentId)

  if (!session) {
    return { ok: false, error: messages.signedOut }
  }

  if (!access) {
    return denied()
  }

  return readState(documentId, access)
}

async function requireOwner(documentId: string) {
  const { session, access } = await resolveAccess(documentId)

  if (!session) {
    return { ok: false as const, error: messages.signedOut }
  }

  if (!canManageShares(access)) {
    return { ok: false as const, error: messages.denied }
  }

  return { ok: true as const, session }
}

export async function inviteToDocument(
  documentId: string,
  email: string,
  role: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  if (!isShareRole(role)) {
    return { ok: false, error: messages.invalidRole }
  }

  const normalized = email.trim().toLowerCase()

  if (normalized.length > maxEmailLength || !emailPattern.test(normalized)) {
    return { ok: false, error: messages.invalidEmail }
  }

  if (normalized === guard.session.user.email.toLowerCase()) {
    return { ok: false, error: messages.ownerEmail }
  }

  const existing = await db.query.documentShares.findFirst({
    where: and(
      eq(documentShares.documentId, documentId),
      eq(documentShares.granteeEmail, normalized),
    ),
  })

  if (existing) {
    await db
      .update(documentShares)
      .set({ role })
      .where(eq(documentShares.id, existing.id))
  } else {
    await db.insert(documentShares).values({
      id: nanoid(12),
      documentId,
      granteeEmail: normalized,
      role,
    })
  }

  revalidatePath('/', 'layout')

  return readState(documentId, 'owner')
}

export async function updateShareRole(
  documentId: string,
  shareId: string,
  role: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  if (!isShareRole(role)) {
    return { ok: false, error: messages.invalidRole }
  }

  const updated = await db
    .update(documentShares)
    .set({ role })
    .where(
      and(
        eq(documentShares.id, shareId),
        eq(documentShares.documentId, documentId),
      ),
    )
    .returning({ id: documentShares.id })

  if (updated.length === 0) {
    return { ok: false, error: messages.shareNotFound }
  }

  revalidatePath('/', 'layout')

  return readState(documentId, 'owner')
}

export async function removeShare(
  documentId: string,
  shareId: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  await db
    .delete(documentShares)
    .where(
      and(
        eq(documentShares.id, shareId),
        eq(documentShares.documentId, documentId),
      ),
    )

  revalidatePath('/', 'layout')

  return readState(documentId, 'owner')
}

export async function enablePublicLink(
  documentId: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  await db
    .update(documents)
    .set({ publicToken: nanoid(publicTokenLength) })
    .where(eq(documents.id, documentId))

  return readState(documentId, 'owner')
}

export async function disablePublicLink(
  documentId: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  await db
    .update(documents)
    .set({ publicToken: null })
    .where(eq(documents.id, documentId))

  return readState(documentId, 'owner')
}

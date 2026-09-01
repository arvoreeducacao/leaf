'use server'

import { and, asc, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizations,
  user,
} from '@/db/schema'
import type { OrgAccess, ShareRole } from '@/db/schema'
import { getSession } from '@/lib/auth'
import type { AccessLevel } from '@/lib/authz'
import { canManageShares, getDocumentAccess } from '@/lib/authz'
import { listSubtreeIds } from '@/lib/documents'
import { emailDomainPolicy, isEmailDomainAllowed } from '@/lib/email-domain'
import {
  isMemberOf,
  listOrganizationEmails,
} from '@/lib/organizations'

export type SharePerson = Readonly<{
  id: string
  email: string
  role: ShareRole
  external: boolean
}>

export type ShareState = Readonly<{
  role: AccessLevel
  ownerEmail: string
  ownerName: string
  people: ReadonlyArray<SharePerson>
  publicToken: string | null
  orgName: string | null
  orgAccess: OrgAccess | null
}>

export type ShareResult =
  | { ok: true; state: ShareState }
  | { ok: false; error: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const maxEmailLength = 254
const publicTokenLength = 24

type ShareMessageKey =
  | 'notAllowed'
  | 'documentNotFound'
  | 'signedOut'
  | 'invalidEmail'
  | 'ownerEmail'
  | 'invalidRole'
  | 'shareNotFound'

async function message(key: ShareMessageKey) {
  return (await getTranslations('errors'))(key)
}

async function denied(): Promise<ShareResult> {
  return { ok: false, error: await message('notAllowed') }
}

function isShareRole(value: string): value is ShareRole {
  return value === 'viewer' || value === 'commenter' || value === 'editor'
}

async function readState(
  documentId: string,
  role: AccessLevel,
  userId: string,
): Promise<ShareResult> {
  const rows = await db
    .select({
      publicToken: documents.publicToken,
      orgId: documents.orgId,
      orgAccess: documents.orgAccess,
      ownerEmail: user.email,
      ownerName: user.name,
    })
    .from(documents)
    .innerJoin(user, eq(user.id, documents.ownerId))
    .where(eq(documents.id, documentId))
    .limit(1)

  const row = rows[0]

  if (!row) {
    return { ok: false, error: await message('documentNotFound') }
  }

  const shares = await db
    .select({
      id: documentShares.id,
      email: documentShares.granteeEmail,
      role: documentShares.role,
    })
    .from(documentShares)
    .where(eq(documentShares.documentId, documentId))
    .orderBy(asc(documentShares.createdAt))

  const visibleOrgId =
    row.orgId && (role === 'owner' || (await isMemberOf(row.orgId, userId)))
      ? row.orgId
      : null

  const organization = visibleOrgId
    ? ((await db.query.organizations.findFirst({
        where: eq(organizations.id, visibleOrgId),
      })) ?? null)
    : null

  const memberEmails = visibleOrgId
    ? new Set(await listOrganizationEmails(visibleOrgId))
    : new Set<string>()

  const people = shares.map((share) => ({
    ...share,
    external: organization !== null && !memberEmails.has(share.email),
  }))

  return {
    ok: true,
    state: {
      role,
      ownerEmail: row.ownerEmail,
      ownerName: row.ownerName,
      people,
      publicToken: role === 'owner' ? row.publicToken : null,
      orgName: organization?.name ?? null,
      orgAccess: organization ? row.orgAccess : null,
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
    return { ok: false, error: await message('signedOut') }
  }

  if (!access) {
    return denied()
  }

  return readState(documentId, access, session.user.id)
}

async function requireOwner(documentId: string) {
  const { session, access } = await resolveAccess(documentId)

  if (!session) {
    return { ok: false as const, error: await message('signedOut') }
  }

  if (!canManageShares(access)) {
    return { ok: false as const, error: await message('notAllowed') }
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
    return { ok: false, error: await message('invalidRole') }
  }

  const normalized = email.trim().toLowerCase()

  if (normalized.length > maxEmailLength || !emailPattern.test(normalized)) {
    return { ok: false, error: await message('invalidEmail') }
  }

  if (normalized === guard.session.user.email.toLowerCase()) {
    return { ok: false, error: await message('ownerEmail') }
  }

  const policy = emailDomainPolicy()

  if (!isEmailDomainAllowed(normalized, policy.domains)) {
    return {
      ok: false,
      error: (await getTranslations('errors'))('domainRestricted', {
        domain: policy.primaryDomain ?? '',
      }),
    }
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

  return readState(documentId, 'owner', guard.session.user.id)
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
    return { ok: false, error: await message('invalidRole') }
  }

  const target = and(
    eq(documentShares.id, shareId),
    eq(documentShares.documentId, documentId),
  )

  const existing = await db
    .select({ id: documentShares.id })
    .from(documentShares)
    .where(target)
    .limit(1)

  if (existing.length === 0) {
    return { ok: false, error: await message('shareNotFound') }
  }

  await db.update(documentShares).set({ role }).where(target)

  revalidatePath('/', 'layout')

  return readState(documentId, 'owner', guard.session.user.id)
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

  return readState(documentId, 'owner', guard.session.user.id)
}

export async function setOrganizationAccess(
  documentId: string,
  access: string,
): Promise<ShareResult> {
  const guard = await requireOwner(documentId)

  if (!guard.ok) {
    return { ok: false, error: guard.error }
  }

  if (access !== 'none' && !isShareRole(access)) {
    return { ok: false, error: await message('invalidRole') }
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  })

  if (
    !document?.orgId ||
    !(await isMemberOf(document.orgId, guard.session.user.id))
  ) {
    return denied()
  }

  const next: OrgAccess | null = access === 'none' ? null : access
  const subtree = await listSubtreeIds(documentId, document.ownerId)

  await db
    .update(documents)
    .set({ orgAccess: next, orgId: document.orgId })
    .where(inArray(documents.id, subtree))

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${documentId}`)

  return readState(documentId, 'owner', guard.session.user.id)
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

  return readState(documentId, 'owner', guard.session.user.id)
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

  return readState(documentId, 'owner', guard.session.user.id)
}

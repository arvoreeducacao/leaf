import { and, asc, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import {
  documents,
  organizationInvites,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import type { InviteRole, OrganizationRole } from '@/db/schema'
import type { DocumentSummary } from '@/lib/documents'

export type Membership = Readonly<{
  orgId: string
  orgName: string
  role: OrganizationRole
  memberId: string
}>

export type OrganizationPerson = Readonly<{
  memberId: string
  userId: string
  name: string
  email: string
  role: OrganizationRole
  createdAt: Date
}>

export type PendingInvite = Readonly<{
  id: string
  email: string
  role: InviteRole
  createdAt: Date
}>

export function canManageOrganization(role: OrganizationRole | null) {
  return role === 'owner' || role === 'admin'
}

export async function getMembership(userId: string): Promise<Membership | null> {
  const rows = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      role: organizationMembers.role,
      memberId: organizationMembers.id,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1)

  return rows[0] ?? null
}

export async function isMemberOf(orgId: string, userId: string) {
  const row = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, userId),
    ),
  })

  return row !== undefined
}

export async function listOrganizationPeople(
  orgId: string,
): Promise<Array<OrganizationPerson>> {
  const rows = await db
    .select({
      memberId: organizationMembers.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: organizationMembers.role,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(user, eq(user.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, orgId))
    .orderBy(asc(organizationMembers.createdAt))

  return rows
}

export async function listPendingInvites(
  orgId: string,
): Promise<Array<PendingInvite>> {
  const rows = await db
    .select({
      id: organizationInvites.id,
      email: organizationInvites.email,
      role: organizationInvites.role,
      createdAt: organizationInvites.createdAt,
    })
    .from(organizationInvites)
    .where(eq(organizationInvites.orgId, orgId))
    .orderBy(asc(organizationInvites.createdAt))

  return rows
}

export async function listOrganizationEmails(orgId: string) {
  const rows = await db
    .select({ email: user.email })
    .from(organizationMembers)
    .innerJoin(user, eq(user.id, organizationMembers.userId))
    .where(eq(organizationMembers.orgId, orgId))

  return rows.map((row) => row.email.toLowerCase())
}

export async function acceptPendingInvites(
  userId: string,
  email: string,
): Promise<Membership | null> {
  const existing = await getMembership(userId)

  if (existing) {
    return existing
  }

  const normalized = email.trim().toLowerCase()

  const invites = await db
    .select({
      id: organizationInvites.id,
      orgId: organizationInvites.orgId,
      role: organizationInvites.role,
    })
    .from(organizationInvites)
    .where(eq(organizationInvites.email, normalized))
    .orderBy(asc(organizationInvites.createdAt))

  const invite = invites[0]

  if (!invite) {
    return null
  }

  await db.insert(organizationMembers).values({
    id: nanoid(12),
    orgId: invite.orgId,
    userId,
    role: invite.role,
  })

  await db
    .delete(organizationInvites)
    .where(eq(organizationInvites.email, normalized))

  await attachOwnerDocuments(invite.orgId, userId)

  return getMembership(userId)
}

export async function listOrganizationDocuments(
  orgId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        isNotNull(documents.orgAccess),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false }))
}

export async function attachOwnerDocuments(orgId: string, userId: string) {
  await db
    .update(documents)
    .set({ orgId })
    .where(and(eq(documents.ownerId, userId), isNull(documents.orgId)))
}

export async function detachMemberDocuments(orgId: string, userId: string) {
  await db
    .update(documents)
    .set({ orgId: null, orgAccess: null })
    .where(and(eq(documents.orgId, orgId), eq(documents.ownerId, userId)))
}

export async function otherOwnersInOrganization(orgId: string, userId: string) {
  const rows = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.role, 'owner'),
        ne(organizationMembers.userId, userId),
      ),
    )

  return rows.length
}

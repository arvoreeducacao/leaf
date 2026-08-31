'use server'

import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import {
  organizationInvites,
  organizationMembers,
  organizations,
} from '@/db/schema'
import type { InviteRole } from '@/db/schema'
import {
  clearActiveOrgId,
  getActiveMembership,
  writeActiveOrgId,
} from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { registerInviteAttempt } from '@/lib/authz'
import {
  attachOwnerDocuments,
  canManageOrganization,
  detachMemberDocuments,
  listMemberships,
  listOrganizationEmails,
  otherOwnersInOrganization,
} from '@/lib/organizations'
import { removeTeamspaceMemberships } from '@/lib/teamspaces'

export type OrgActionResult = { ok: true } | { ok: false; error: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const maxEmailLength = 254
const maxNameLength = 80

async function orgMessage(key: string) {
  return (await getTranslations('org'))(key)
}

async function failure(key: string): Promise<OrgActionResult> {
  return { ok: false, error: await orgMessage(key) }
}

async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

function isInviteRole(value: string): value is InviteRole {
  return value === 'admin' || value === 'member'
}

export async function setActiveOrganization(
  orgId: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const memberships = await listMemberships(session.user.id)

  if (!memberships.some((membership) => membership.orgId === orgId)) {
    return failure('errorNotAllowed')
  }

  await writeActiveOrgId(orgId)

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function createOrganization(
  name: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const existing = await listMemberships(session.user.id)

  const trimmed = name.trim().slice(0, maxNameLength)

  if (trimmed.length === 0) {
    return failure('errorEmptyName')
  }

  const orgId = nanoid(12)

  await db.insert(organizations).values({ id: orgId, name: trimmed })
  await db.insert(organizationMembers).values({
    id: nanoid(12),
    orgId,
    userId: session.user.id,
    role: 'owner',
  })

  await db
    .delete(organizationInvites)
    .where(
      and(
        eq(organizationInvites.orgId, orgId),
        eq(organizationInvites.email, session.user.email.toLowerCase()),
      ),
    )

  if (existing.length === 0) {
    await attachOwnerDocuments(orgId, session.user.id)
  }

  await writeActiveOrgId(orgId)

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function renameOrganization(
  name: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership || !canManageOrganization(membership.role)) {
    return failure('errorNotAllowed')
  }

  const trimmed = name.trim().slice(0, maxNameLength)

  if (trimmed.length === 0) {
    return failure('errorEmptyName')
  }

  await db
    .update(organizations)
    .set({ name: trimmed })
    .where(eq(organizations.id, membership.orgId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function inviteToOrganization(
  email: string,
  role: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership || !canManageOrganization(membership.role)) {
    return failure('errorNotAllowed')
  }

  const decision = registerInviteAttempt(`${membership.orgId}:${session.user.id}`)

  if (!decision.allowed) {
    return {
      ok: false,
      error: (await getTranslations('org'))('errorTooManyInvites', {
        seconds: decision.retryAfterSeconds,
      }),
    }
  }

  if (!isInviteRole(role)) {
    return failure('errorInvalidRole')
  }

  const normalized = email.trim().toLowerCase()

  if (normalized.length > maxEmailLength || !emailPattern.test(normalized)) {
    return failure('errorInvalidEmail')
  }

  const memberEmails = await listOrganizationEmails(membership.orgId)

  if (memberEmails.includes(normalized)) {
    return failure('errorAlreadyInOrg')
  }

  const existing = await db.query.organizationInvites.findFirst({
    where: and(
      eq(organizationInvites.orgId, membership.orgId),
      eq(organizationInvites.email, normalized),
    ),
  })

  if (existing) {
    await db
      .update(organizationInvites)
      .set({ role })
      .where(eq(organizationInvites.id, existing.id))
  } else {
    await db.insert(organizationInvites).values({
      id: nanoid(12),
      orgId: membership.orgId,
      email: normalized,
      role,
    })
  }

  revalidatePath('/org')

  return { ok: true }
}

export async function cancelOrganizationInvite(
  inviteId: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership || !canManageOrganization(membership.role)) {
    return failure('errorNotAllowed')
  }

  await db
    .delete(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, inviteId),
        eq(organizationInvites.orgId, membership.orgId),
      ),
    )

  revalidatePath('/org')

  return { ok: true }
}

export async function updateMemberRole(
  memberId: string,
  role: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership || !canManageOrganization(membership.role)) {
    return failure('errorNotAllowed')
  }

  if (!isInviteRole(role)) {
    return failure('errorInvalidRole')
  }

  const target = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.orgId, membership.orgId),
    ),
  })

  if (!target) {
    return failure('errorMemberNotFound')
  }

  if (target.role === 'owner') {
    return failure('errorOwnerLocked')
  }

  await db
    .update(organizationMembers)
    .set({ role })
    .where(eq(organizationMembers.id, memberId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function removeMember(
  memberId: string,
): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership || !canManageOrganization(membership.role)) {
    return failure('errorNotAllowed')
  }

  const target = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.orgId, membership.orgId),
    ),
  })

  if (!target) {
    return failure('errorMemberNotFound')
  }

  if (target.role === 'owner') {
    return failure('errorOwnerLocked')
  }

  await detachMemberDocuments(membership.orgId, target.userId)
  await removeTeamspaceMemberships(membership.orgId, target.userId)
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, memberId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function leaveOrganization(): Promise<OrgActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership) {
    return failure('errorNotAllowed')
  }

  if (
    membership.role === 'owner' &&
    (await otherOwnersInOrganization(membership.orgId, session.user.id)) === 0
  ) {
    return failure('errorOwnerCannotLeave')
  }

  await detachMemberDocuments(membership.orgId, session.user.id)
  await removeTeamspaceMemberships(membership.orgId, session.user.id)
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, membership.memberId))

  const remaining = await listMemberships(session.user.id)
  const next = remaining[0]

  if (next) {
    await writeActiveOrgId(next.orgId)
  } else {
    await clearActiveOrgId()
  }

  revalidatePath('/', 'layout')

  return { ok: true }
}


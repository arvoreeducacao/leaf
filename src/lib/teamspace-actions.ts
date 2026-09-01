'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { documents, teamspaceMembers, teamspaces } from '@/db/schema'
import type { TeamspaceAccess } from '@/db/schema'
import { getActiveMembership } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { listSubtreeIds } from '@/lib/documents'
import {
  canManageTeamspace,
  canPlaceDocuments,
  getTeamspace,
  getTeamspaceRole,
  isOrganizationMember,
  otherOwnersInTeamspace,
} from '@/lib/teamspaces'

export type TeamspaceActionResult = { ok: true } | { ok: false; error: string }

export type TeamspaceTarget = Readonly<{ id: string; name: string }>

export type TeamspaceTargetsResult =
  | {
      ok: true
      targets: Array<TeamspaceTarget>
      currentTeamspaceId: string | null
    }
  | { ok: false; error: string }

const maxNameLength = 60

async function failure(
  key: string,
): Promise<{ ok: false; error: string }> {
  return { ok: false, error: (await getTranslations('teamspace'))(key) }
}

async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

function isAccess(value: string): value is TeamspaceAccess {
  return value === 'open' || value === 'closed'
}

async function requireManager(teamspaceId: string) {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)
  const teamspace = await getTeamspace(teamspaceId)

  if (!teamspace || !membership || teamspace.orgId !== membership.orgId) {
    return null
  }

  const role = await getTeamspaceRole(teamspaceId, session.user.id)

  if (!canManageTeamspace(role, membership.role)) {
    return null
  }

  return { session, membership, teamspace, role }
}

export async function createTeamspace(
  name: string,
  access: string,
): Promise<TeamspaceActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)

  if (!membership) {
    return failure('errorNoOrganization')
  }

  if (!isAccess(access)) {
    return failure('errorInvalidAccess')
  }

  const trimmed = name.trim().slice(0, maxNameLength)

  if (trimmed.length === 0) {
    return failure('errorEmptyName')
  }

  const teamspaceId = nanoid(12)

  await db.insert(teamspaces).values({
    id: teamspaceId,
    orgId: membership.orgId,
    name: trimmed,
    access,
  })

  await db.insert(teamspaceMembers).values({
    id: nanoid(12),
    teamspaceId,
    userId: session.user.id,
    role: 'owner',
  })

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function updateTeamspace(
  teamspaceId: string,
  name: string,
  access: string,
): Promise<TeamspaceActionResult> {
  const context = await requireManager(teamspaceId)

  if (!context) {
    return failure('errorNotAllowed')
  }

  if (!isAccess(access)) {
    return failure('errorInvalidAccess')
  }

  const trimmed = name.trim().slice(0, maxNameLength)

  if (trimmed.length === 0) {
    return failure('errorEmptyName')
  }

  await db
    .update(teamspaces)
    .set({ name: trimmed, access })
    .where(eq(teamspaces.id, teamspaceId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function deleteTeamspace(
  teamspaceId: string,
): Promise<TeamspaceActionResult> {
  const context = await requireManager(teamspaceId)

  if (!context) {
    return failure('errorNotAllowed')
  }

  await db
    .update(documents)
    .set({ teamspaceId: null })
    .where(eq(documents.teamspaceId, teamspaceId))
  await db.delete(teamspaces).where(eq(teamspaces.id, teamspaceId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function joinTeamspace(
  teamspaceId: string,
): Promise<TeamspaceActionResult> {
  const session = await requireSession()
  const membership = await getActiveMembership(session.user.id)
  const teamspace = await getTeamspace(teamspaceId)

  if (!teamspace || !membership || teamspace.orgId !== membership.orgId) {
    return failure('errorNotAllowed')
  }

  if (teamspace.access !== 'open') {
    return failure('errorClosedTeamspace')
  }

  const role = await getTeamspaceRole(teamspaceId, session.user.id)

  if (role) {
    return { ok: true }
  }

  await db.insert(teamspaceMembers).values({
    id: nanoid(12),
    teamspaceId,
    userId: session.user.id,
    role: 'member',
  })

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function leaveTeamspace(
  teamspaceId: string,
): Promise<TeamspaceActionResult> {
  const session = await requireSession()
  const role = await getTeamspaceRole(teamspaceId, session.user.id)

  if (!role) {
    return failure('errorNotAllowed')
  }

  if (
    role === 'owner' &&
    (await otherOwnersInTeamspace(teamspaceId, session.user.id)) === 0
  ) {
    return failure('errorLastOwner')
  }

  await db
    .delete(teamspaceMembers)
    .where(
      and(
        eq(teamspaceMembers.teamspaceId, teamspaceId),
        eq(teamspaceMembers.userId, session.user.id),
      ),
    )

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function addTeamspaceMember(
  teamspaceId: string,
  userId: string,
): Promise<TeamspaceActionResult> {
  const context = await requireManager(teamspaceId)

  if (!context) {
    return failure('errorNotAllowed')
  }

  if (!(await isOrganizationMember(context.teamspace.orgId, userId))) {
    return failure('errorNotInOrganization')
  }

  if (await getTeamspaceRole(teamspaceId, userId)) {
    return failure('errorAlreadyMember')
  }

  await db.insert(teamspaceMembers).values({
    id: nanoid(12),
    teamspaceId,
    userId,
    role: 'member',
  })

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function removeTeamspaceMember(
  teamspaceId: string,
  memberId: string,
): Promise<TeamspaceActionResult> {
  const context = await requireManager(teamspaceId)

  if (!context) {
    return failure('errorNotAllowed')
  }

  const target = await db.query.teamspaceMembers.findFirst({
    where: and(
      eq(teamspaceMembers.id, memberId),
      eq(teamspaceMembers.teamspaceId, teamspaceId),
    ),
  })

  if (!target) {
    return failure('errorMemberNotFound')
  }

  if (
    target.role === 'owner' &&
    (await otherOwnersInTeamspace(teamspaceId, target.userId)) === 0
  ) {
    return failure('errorLastOwner')
  }

  await db.delete(teamspaceMembers).where(eq(teamspaceMembers.id, memberId))

  revalidatePath('/', 'layout')

  return { ok: true }
}

export async function listTeamspaceTargets(
  documentId: string,
): Promise<TeamspaceTargetsResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(documentId, session)

  if (access !== 'owner') {
    return failure('errorNotAllowed')
  }

  const membership = await getActiveMembership(session.user.id)

  if (!membership) {
    return { ok: true, targets: [], currentTeamspaceId: null }
  }

  const rows = await db
    .select({
      id: teamspaces.id,
      name: teamspaces.name,
      access: teamspaces.access,
      role: teamspaceMembers.role,
    })
    .from(teamspaces)
    .leftJoin(
      teamspaceMembers,
      and(
        eq(teamspaceMembers.teamspaceId, teamspaces.id),
        eq(teamspaceMembers.userId, session.user.id),
      ),
    )
    .where(eq(teamspaces.orgId, membership.orgId))

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  })

  const targets = rows
    .filter((row) => row.role !== null || row.access === 'open')
    .map((row) => ({ id: row.id, name: row.name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  return {
    ok: true,
    targets,
    currentTeamspaceId: document?.teamspaceId ?? null,
  }
}

export async function moveDocumentToTeamspace(
  documentId: string,
  teamspaceId: string | null,
): Promise<TeamspaceActionResult> {
  const session = await requireSession()
  const access = await getDocumentAccess(documentId, session)

  if (access !== 'owner') {
    return failure('errorNotAllowed')
  }

  const membership = await getActiveMembership(session.user.id)

  if (
    teamspaceId &&
    !(await canPlaceDocuments(
      teamspaceId,
      session.user.id,
      membership?.orgId ?? null,
    ))
  ) {
    return failure('errorNotAllowed')
  }

  const subtree = await listSubtreeIds(documentId, session.user.id)
  const teamspace = teamspaceId ? await getTeamspace(teamspaceId) : null

  await db
    .update(documents)
    .set(
      teamspace
        ? { teamspaceId: teamspace.id, orgId: teamspace.orgId }
        : { teamspaceId: null },
    )
    .where(inArray(documents.id, subtree))

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${documentId}`)

  return { ok: true }
}

'use server'

import { getActiveMembership } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import { isMemberOf } from '@/lib/organizations'
import type { MentionablePerson } from '@/lib/mention-people'
import { findMentionablePeople } from '@/lib/mention-people'
import type { NotificationItem } from '@/lib/notifications'
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from '@/lib/notifications'

const MAX_QUERY_LENGTH = 80

export async function searchMentionablePeople(
  documentId: string,
  query: string,
): Promise<Array<MentionablePerson>> {
  const session = await getSession()

  if (!session || typeof query !== 'string') {
    return []
  }

  const access = await getDocumentAccess(documentId, session)

  if (!canEdit(access)) {
    return []
  }

  const document = await getDocument(documentId)
  const orgId =
    document?.orgId ??
    (await getActiveMembership(session.user.id))?.orgId ??
    null

  if (!orgId || !(await isMemberOf(orgId, session.user.id))) {
    return []
  }

  return findMentionablePeople({
    documentId,
    orgId,
    query: query.slice(0, MAX_QUERY_LENGTH),
  })
}

export async function loadMyNotifications(): Promise<Array<NotificationItem> | null> {
  const session = await getSession()

  if (!session) {
    return null
  }

  return listNotifications(session.user)
}

export async function countMyUnreadNotifications(): Promise<number> {
  const session = await getSession()

  return session ? countUnreadNotifications(session.user.id) : 0
}

export async function readMyNotifications(): Promise<void> {
  const session = await getSession()

  if (session) {
    await markNotificationsRead(session.user.id)
  }
}

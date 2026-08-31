'use server'

import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import {
  applyDocumentVersion,
  getDocumentVersion,
  listDocumentVersions,
} from '@/lib/document-versions'
import type { VersionDetail, VersionSummary } from '@/lib/document-versions'

export type VersionListResult =
  | { ok: true; versions: Array<VersionSummary> }
  | { ok: false; error: string }

export type VersionDetailResult =
  | { ok: true; version: VersionDetail }
  | { ok: false; error: string }

export type RestoreVersionResult =
  | { ok: true; title: string }
  | { ok: false; error: string }

async function requireEditor(documentId: string) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const access = await getDocumentAccess(documentId, session)

  if (!canEdit(access)) {
    const t = await getTranslations('errors')

    return { ok: false as const, error: t('notAllowed') }
  }

  return { ok: true as const, session }
}

export async function loadDocumentVersions(
  documentId: string,
): Promise<VersionListResult> {
  const guard = await requireEditor(documentId)

  if (!guard.ok) {
    return guard
  }

  return { ok: true, versions: await listDocumentVersions(documentId) }
}

export async function loadDocumentVersion(
  documentId: string,
  versionId: string,
): Promise<VersionDetailResult> {
  const guard = await requireEditor(documentId)

  if (!guard.ok) {
    return guard
  }

  const version = await getDocumentVersion(documentId, versionId)

  if (!version) {
    const t = await getTranslations('versions')

    return { ok: false, error: t('notFound') }
  }

  return { ok: true, version }
}

export async function restoreDocumentVersion(
  documentId: string,
  versionId: string,
): Promise<RestoreVersionResult> {
  const guard = await requireEditor(documentId)

  if (!guard.ok) {
    return guard
  }

  const restored = await applyDocumentVersion(
    documentId,
    versionId,
    guard.session.user.id,
  )

  if (!restored) {
    const t = await getTranslations('versions')

    return { ok: false, error: t('notFound') }
  }

  revalidatePath('/', 'layout')
  revalidatePath(`/doc/${documentId}`)

  return { ok: true, title: restored.title }
}

'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import { recordDocumentVersion } from '@/lib/document-versions'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { MAX_MARKDOWN_BYTES, MAX_MARKDOWN_LABEL } from '@/lib/markdown/limits'
import { looksBinary } from '@/lib/markdown/text'

export type ImportBlocksResult =
  | { ok: true; blocks: string }
  | { ok: false; error: string }

export async function importMarkdownBlocks(
  documentId: string,
  mdText: string,
): Promise<ImportBlocksResult> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const t = await getTranslations('importFile')

  if (!canEdit(await getDocumentAccess(documentId, session))) {
    return { ok: false, error: (await getTranslations('errors'))('notAllowed') }
  }

  if (typeof mdText !== 'string' || mdText.trim().length === 0) {
    return { ok: false, error: t('empty') }
  }

  if (Buffer.byteLength(mdText, 'utf8') > MAX_MARKDOWN_BYTES) {
    return {
      ok: false,
      error: t('markdownTooLarge', { limit: MAX_MARKDOWN_LABEL }),
    }
  }

  if (looksBinary(mdText)) {
    return { ok: false, error: t('binary') }
  }

  try {
    const blocks = await markdownToBlocks(mdText)

    if (blocks.length === 0) {
      return { ok: false, error: t('noContent') }
    }

    await recordDocumentVersion(documentId, session.user.id, { force: true })

    return { ok: true, blocks: JSON.stringify(blocks) }
  } catch {
    return { ok: false, error: t('unreadable') }
  }
}

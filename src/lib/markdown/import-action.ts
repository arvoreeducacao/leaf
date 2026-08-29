'use server'

import { nanoid } from 'nanoid'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { markdownToBlocks } from '@/lib/markdown/convert'
import { titleFromFileName } from '@/lib/markdown/filename'
import { MAX_MARKDOWN_BYTES, MAX_MARKDOWN_LABEL } from '@/lib/markdown/limits'
import { looksBinary } from '@/lib/markdown/text'

export type ImportResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function importMarkdown(
  fileName: string,
  mdText: string,
): Promise<ImportResult> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const t = await getTranslations('importFile')

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

  let content: string

  try {
    const blocks = await markdownToBlocks(mdText)

    if (blocks.length === 0) {
      return { ok: false, error: t('noContent') }
    }

    content = JSON.stringify(blocks)
  } catch {
    return { ok: false, error: t('unreadable') }
  }

  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: session.user.id,
    title: titleFromFileName(
      fileName,
      (await getTranslations('document'))('untitled'),
    ),
    content,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/', 'layout')

  return { ok: true, id }
}

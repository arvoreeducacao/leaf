'use server'

import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { markdownToContent } from '@/lib/markdown/convert'
import { titleFromFileName } from '@/lib/markdown/filename'
import { MAX_MARKDOWN_BYTES, MAX_MARKDOWN_LABEL } from '@/lib/markdown/limits'

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

  if (typeof mdText !== 'string' || mdText.trim().length === 0) {
    return { ok: false, error: 'O arquivo está vazio' }
  }

  if (Buffer.byteLength(mdText, 'utf8') > MAX_MARKDOWN_BYTES) {
    return {
      ok: false,
      error: `O arquivo passa de ${MAX_MARKDOWN_LABEL}`,
    }
  }

  let content: string

  try {
    content = await markdownToContent(mdText)
  } catch {
    return { ok: false, error: 'Não foi possível ler esse markdown' }
  }

  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: session.user.id,
    title: titleFromFileName(fileName),
    content,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/', 'layout')

  return { ok: true, id }
}

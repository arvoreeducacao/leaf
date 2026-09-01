import { getLocale, getTranslations } from 'next-intl/server'

import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import {
  databaseToMarkdown,
  expandDatabaseBlocks,
} from '@/lib/database/export'
import { getDocument } from '@/lib/documents'
import {
  contentToHTML,
  contentToMarkdown,
  documentToMarkdownFile,
  markdownToBlocks,
  parseContentBlocks,
} from '@/lib/markdown/convert'
import { toFileSlug } from '@/lib/markdown/filename'

type Params = Readonly<{ params: Promise<{ id: string }> }>

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const t = await getTranslations('uploads')
  const session = await getSession()
  const access = await getDocumentAccess(id, session)

  if (!access) {
    return new Response(t('documentNotFound'), { status: 404 })
  }

  const document = await getDocument(id)

  if (!document) {
    return new Response(t('documentNotFound'), { status: 404 })
  }

  const requestUrl = new URL(request.url)
  const format = requestUrl.searchParams.get('format') === 'html' ? 'html' : 'md'
  const origin = requestUrl.origin
  const locale = await getLocale()
  const tDatabase = await getTranslations('database')
  const titleColumn = tDatabase('titleColumn')
  const emptyTitle = tDatabase('untitledRow')

  const content =
    document.kind === 'database'
      ? JSON.stringify(
          await markdownToBlocks(
            (await databaseToMarkdown(
              document.id,
              titleColumn,
              emptyTitle,
              locale,
            )) ?? '',
          ),
        )
      : JSON.stringify(
          await expandDatabaseBlocks(
            parseContentBlocks(document.content),
            titleColumn,
            emptyTitle,
            locale,
          ),
        )

  const body =
    format === 'html'
      ? await contentToHTML(content, document.title, origin)
      : documentToMarkdownFile(
          document.title,
          await contentToMarkdown(content, origin),
          parseContentBlocks(content),
        )

  return new Response(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${toFileSlug(document.title)}.${format}"`,
      'Content-Type':
        format === 'html'
          ? 'text/html; charset=utf-8'
          : 'text/markdown; charset=utf-8',
    },
  })
}

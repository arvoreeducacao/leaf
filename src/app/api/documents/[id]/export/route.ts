import { getSession } from '@/lib/auth'
import { getDocumentAccess } from '@/lib/authz'
import { getDocument } from '@/lib/documents'
import { contentToHTML, contentToMarkdown } from '@/lib/markdown/convert'
import { toFileSlug } from '@/lib/markdown/filename'

type Params = Readonly<{ params: Promise<{ id: string }> }>

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  const access = await getDocumentAccess(id, session)

  if (!access) {
    return new Response('Documento não encontrado', { status: 404 })
  }

  const document = await getDocument(id)

  if (!document) {
    return new Response('Documento não encontrado', { status: 404 })
  }

  const format =
    new URL(request.url).searchParams.get('format') === 'html' ? 'html' : 'md'

  const body =
    format === 'html'
      ? await contentToHTML(document.content, document.title)
      : `# ${document.title}\n\n${await contentToMarkdown(document.content)}`

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

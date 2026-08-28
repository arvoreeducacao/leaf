import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { DocumentRenderer } from '@/components/editor/document-renderer'
import { LeafIcon, LockIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { lookupPublicDocument } from '@/lib/authz'

type Props = Readonly<{ params: Promise<{ token: string }> }>

async function requesterKey() {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()

  return forwarded || headerList.get('x-real-ip') || 'unknown'
}

const lookup = cache(async (token: string) =>
  lookupPublicDocument(token, await requesterKey()),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const result = await lookup(token)

  return {
    title:
      result.status === 'ok' ? `${result.document.title} | Leaf` : 'Leaf',
  }
}

function ShareHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-alpha-200 border-b bg-white px-4 py-3 tablet:px-8">
      <Link
        aria-label="Ir para o Leaf"
        className="flex items-center gap-2 rounded-large outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        href="/"
      >
        <LeafIcon aria-hidden="true" className="size-5 text-primary-700" />
        <span className="font-bold text-body-medium text-gray-900">Leaf</span>
      </Link>
      <Badge variant="info">Somente leitura</Badge>
    </header>
  )
}

export default async function SharedDocumentPage({ params }: Props) {
  const { token } = await params
  const result = await lookup(token)

  if (result.status === 'rate-limited') {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <ShareHeader />
        <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center tablet:px-8">
          <LockIcon aria-hidden="true" className="size-10 text-gray-600" />
          <h1 className="font-bold text-heading-large text-gray-900">
            Muitas tentativas
          </h1>
          <p className="max-w-110 text-body-medium text-gray-700">
            Aguarde um minuto e abra o link novamente
          </p>
          <Button asChild>
            <Link href="/">Ir para o Leaf</Link>
          </Button>
        </main>
      </div>
    )
  }

  if (result.status !== 'ok') {
    notFound()
  }

  const document = result.document

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <ShareHeader />
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 tablet:px-8 tablet:py-10">
        <article className="mx-auto flex w-full max-w-prose-leaf flex-col gap-6">
          <h1 className="font-bold text-heading-large text-gray-900 tablet:text-display-small">
            {document.title}
          </h1>
          <DocumentRenderer content={document.content} />
        </article>
      </main>
    </div>
  )
}

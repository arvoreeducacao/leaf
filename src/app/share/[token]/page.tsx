import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
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
  const t = await getTranslations('metadata')

  return {
    title:
      result.status === 'ok'
        ? t('document', { title: result.document.title })
        : t('title'),
  }
}

async function ShareHeader() {
  const t = await getTranslations('publicShare')
  const tCommon = await getTranslations('common')

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-line border-b bg-surface-app px-4 py-3 tablet:px-8">
      <Link
        aria-label={tCommon('goToLeaf')}
        className="flex items-center gap-2 rounded-large outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        href="/"
      >
        <LeafIcon aria-hidden="true" className="size-5 text-brand" />
        <span className="font-bold text-body-medium text-content-strong">Leaf</span>
      </Link>
      <Badge variant="info">{t('readOnly')}</Badge>
    </header>
  )
}

export default async function SharedDocumentPage({ params }: Props) {
  const { token } = await params
  const result = await lookup(token)
  const t = await getTranslations('publicShare')
  const tCommon = await getTranslations('common')

  if (result.status === 'rate-limited') {
    return (
      <div className="flex min-h-dvh flex-col bg-surface-app">
        <ShareHeader />
        <main className="mx-auto flex w-full max-w-content flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center tablet:px-8">
          <LockIcon aria-hidden="true" className="size-10 text-content-muted" />
          <h1 className="font-bold text-heading-large text-content-strong">
            {t('rateLimitedTitle')}
          </h1>
          <p className="max-w-110 text-body-medium text-content">
            {t('rateLimitedBody')}
          </p>
          <Button asChild>
            <Link href="/">{tCommon('goToLeaf')}</Link>
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
    <div className="flex min-h-dvh flex-col bg-surface-app">
      <ShareHeader />
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 tablet:px-8 tablet:py-10">
        <article className="mx-auto flex w-full max-w-prose-leaf flex-col gap-6">
          <h1 className="font-bold text-heading-large text-content-strong tablet:text-display-small">
            {document.title}
          </h1>
          <DocumentRenderer content={document.content} />
        </article>
      </main>
    </div>
  )
}

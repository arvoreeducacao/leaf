import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { DocumentCover } from '@/components/app/document-cover'
import { LeafMark } from '@/components/app/leaf-mark'
import { DocumentRenderer } from '@/components/editor/document-renderer'
import { LockIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { lookupPublicDocument } from '@/lib/authz'
import { parseCoverCredit } from '@/lib/document-cover'
import { cn } from '@/shared/utils'

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
    <header className="sticky top-0 z-10 flex h-11 items-center justify-between gap-3 bg-surface-app px-4 tablet:px-6">
      <Link
        aria-label={tCommon('goToLeaf')}
        className="flex items-center gap-2 rounded-large outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/"
      >
        <LeafMark aria-hidden="true" className="size-4 text-brand" />
        <span className="font-semibold text-body-small text-content-strong">
          Leaf
        </span>
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
        <main className="mx-auto flex w-full max-w-page flex-1 flex-col gap-3 px-4 pt-20 tablet:px-[54px]">
          <LockIcon aria-hidden="true" className="size-7 text-content-subtle" />
          <h1 className="font-semibold text-content-strong text-heading-large">
            {t('rateLimitedTitle')}
          </h1>
          <p className="max-w-prose-leaf text-body-medium text-content">
            {t('rateLimitedBody')}
          </p>
          <Button asChild className="mt-3 self-start">
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
      {document.cover ? (
        <DocumentCover
          canEdit={false}
          cover={document.cover}
          credit={parseCoverCredit(document.coverCredit)}
          documentId={document.id}
          position={document.coverPosition}
          unsplashEnabled={false}
        />
      ) : null}
      <main
        className={cn(
          'mx-auto w-full max-w-page flex-1 pb-40',
          document.cover ? 'pt-6 tablet:pt-10' : 'pt-10 tablet:pt-16',
        )}
      >
        <article className="flex w-full flex-col gap-2">
          <h1 className="px-4 font-heavy text-content-strong text-display-medium tablet:px-[54px]">
            {document.title}
          </h1>
          <DocumentRenderer content={document.content} />
        </article>
      </main>
    </div>
  )
}

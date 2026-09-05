import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { LeafMark } from '@/components/app/leaf-mark'
import { FormRunner } from '@/components/forms/form-runner'
import { LockIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { lookupPublicForm } from '@/lib/forms'

type Props = Readonly<{ params: Promise<{ token: string }> }>

async function requesterKey() {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()

  return forwarded || headerList.get('x-real-ip') || 'unknown'
}

const lookup = cache(async (token: string) =>
  lookupPublicForm(
    token,
    await requesterKey(),
    (await getTranslations('database'))('titleColumn'),
  ),
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const result = await lookup(token)
  const t = await getTranslations('metadata')

  if (result.status !== 'ok') {
    return { title: t('title') }
  }

  const { config, databaseTitle } = result.form

  return {
    title: t('document', {
      title: config.headline.length > 0 ? config.headline : databaseTitle,
    }),
  }
}

function FormShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-app">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-2 bg-surface-app px-4 tablet:px-6">
        <Link
          className="flex items-center gap-2 rounded-large outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/"
        >
          <LeafMark aria-hidden="true" className="size-4 text-brand" />
          <span className="font-semibold text-body-small text-content-strong">
            Leaf
          </span>
        </Link>
      </header>
      {children}
    </div>
  )
}

export default async function PublicFormPage({ params }: Props) {
  const { token } = await params
  const result = await lookup(token)
  const t = await getTranslations('form')
  const tCommon = await getTranslations('common')

  if (result.status === 'rate-limited') {
    return (
      <FormShell>
        <main className="mx-auto flex w-full max-w-135 flex-1 flex-col gap-3 px-4 pt-20 tablet:px-8">
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
      </FormShell>
    )
  }

  if (result.status !== 'ok') {
    notFound()
  }

  return (
    <FormShell>
      <main className="mx-auto w-full max-w-135 flex-1 px-4 py-10 tablet:px-8 tablet:py-16">
        <FormRunner form={result.form} />
      </main>
    </FormShell>
  )
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { OrganizationGraph } from '@/components/graph/organization-graph'
import { getSession } from '@/lib/auth'
import { documentIdsFromQuery } from '@/lib/document-links'

type Props = Readonly<{
  searchParams: Promise<{ pagina?: string; saltos?: string }>
}>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('graph')

  return { title: t('title') }
}

export default async function GraphPage({ searchParams }: Props) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { pagina, saltos } = await searchParams
  const focus = documentIdsFromQuery(pagina ?? null)[0] ?? null

  return (
    <OrganizationGraph
      initialDepth={saltos === '2' ? 2 : 1}
      initialFocusId={focus}
    />
  )
}

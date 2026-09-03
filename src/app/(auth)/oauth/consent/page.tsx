import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { ConsentForm } from '@/components/oauth/consent-form'
import { ConsentInvalid } from '@/components/oauth/consent-invalid'
import { getSession } from '@/lib/auth'
import { getConsentClient } from '@/lib/connected-apps'
import { isMcpEnabled, mcpScopes } from '@/lib/mcp-config'

type SearchParams = Record<string, string | Array<string> | undefined>

type Props = Readonly<{ searchParams: Promise<SearchParams> }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('consent') }
}

function first(value: string | Array<string> | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function toQuery(params: SearchParams) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        query.append(key, item)
      }
    }
  }

  return query.toString()
}

function hostOf(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).host
  } catch {
    return null
  }
}

export default async function ConsentPage({ searchParams }: Props) {
  if (!isMcpEnabled()) {
    notFound()
  }

  const params = await searchParams
  const session = await getSession()

  if (!session) {
    redirect(`/login?${toQuery(params)}`)
  }

  const clientId = first(params.client_id)
  const signature = first(params.sig)
  const client = clientId ? await getConsentClient(clientId) : null

  if (!client || !signature) {
    return <ConsentInvalid />
  }

  const known = new Set<string>(mcpScopes)
  const requested = (first(params.scope) ?? '')
    .split(' ')
    .filter((scope) => known.has(scope))

  return (
    <ConsentForm
      clientName={client.name?.trim() || null}
      clientUri={client.uri}
      redirectHost={hostOf(first(params.redirect_uri))}
      scopes={requested}
      userEmail={session.user.email}
    />
  )
}

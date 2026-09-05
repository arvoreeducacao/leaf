import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth/auth-form'
import { authAccessConfig, getSession, ssoSignOutUrl } from '@/lib/auth'

type Props = Readonly<{
  searchParams: Promise<Record<string, string | Array<string> | undefined>>
}>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('login') }
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  const { googleEnabled, restrictedDomain, sso } = authAccessConfig()
  const { error } = await searchParams

  return (
    <AuthForm
      errorCode={typeof error === 'string' ? error : null}
      googleEnabled={googleEnabled}
      mode="login"
      passwordEnabled={sso === null}
      restrictedDomain={restrictedDomain}
      sso={sso}
      ssoSignOutUrl={await ssoSignOutUrl()}
    />
  )
}

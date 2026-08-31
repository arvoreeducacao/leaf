import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth/auth-form'
import { SsoSignIn } from '@/components/auth/sso-sign-in'
import { arvoreSsoProviderId, authAccessConfig, getSession } from '@/lib/auth'

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

  const { restrictedDomain, ssoEnabled } = authAccessConfig()

  if (ssoEnabled) {
    const { error } = await searchParams

    return (
      <SsoSignIn
        errorCode={typeof error === 'string' ? error : null}
        providerId={arvoreSsoProviderId}
        restrictedDomain={restrictedDomain}
      />
    )
  }

  return <AuthForm mode="login" restrictedDomain={restrictedDomain} />
}

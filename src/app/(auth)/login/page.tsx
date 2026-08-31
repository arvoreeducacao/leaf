import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth/auth-form'
import { authAccessConfig, getSession } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('login') }
}

export default async function LoginPage() {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  const { googleEnabled, restrictedDomain } = authAccessConfig()

  return (
    <AuthForm
      googleEnabled={googleEnabled}
      mode="login"
      restrictedDomain={restrictedDomain}
    />
  )
}

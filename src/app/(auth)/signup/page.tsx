import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth/auth-form'
import { getSession } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('signup') }
}

export default async function SignupPage() {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  return <AuthForm mode="signup" />
}

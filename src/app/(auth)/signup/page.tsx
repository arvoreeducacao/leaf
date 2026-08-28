import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth/auth-form'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Criar conta | Leaf',
}

export default async function SignupPage() {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  return <AuthForm mode="signup" />
}

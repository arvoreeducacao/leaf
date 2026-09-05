import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { AccountForm } from '@/components/account/account-form'
import { getSession } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata')

  return { title: t('account') }
}

export default async function AccountPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8 tablet:px-8 tablet:py-10">
      <AccountForm
        email={session.user.email}
        image={session.user.image ?? null}
        name={session.user.name}
        userId={session.user.id}
      />
    </div>
  )
}

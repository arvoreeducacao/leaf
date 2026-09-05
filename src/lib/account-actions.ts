'use server'

import { eq } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { user } from '@/db/schema'
import { getSession } from '@/lib/auth'
import { normalizeAvatar } from '@/lib/avatar'
import { normalizeDisplayName } from '@/lib/display-name'

export type AccountActionResult = { ok: true } | { ok: false; error: string }

async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

async function writeAccount(
  userId: string,
  values: { name?: string; image?: string | null },
) {
  await db
    .update(user)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath('/', 'layout')
}

export async function saveAccountName(
  value: string,
): Promise<AccountActionResult> {
  const session = await requireSession()
  const name = normalizeDisplayName(value)

  if (!name) {
    const t = await getTranslations('account')

    return { ok: false, error: t('nameRequired') }
  }

  await writeAccount(session.user.id, { name })

  return { ok: true }
}

export async function setAccountAvatar(
  value: string,
): Promise<AccountActionResult> {
  const session = await requireSession()
  const image = normalizeAvatar(value)

  if (!image) {
    const t = await getTranslations('account')

    return { ok: false, error: t('avatarInvalid') }
  }

  await writeAccount(session.user.id, { image })

  return { ok: true }
}

export async function removeAccountAvatar(): Promise<AccountActionResult> {
  const session = await requireSession()

  await writeAccount(session.user.id, { image: null })

  return { ok: true }
}

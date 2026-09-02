'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { normalizeSidebarLayout } from '@/lib/sidebar-layout'
import { writeSidebarLayout } from '@/lib/sidebar-layout-store'

export type SidebarActionResult = { ok: true } | { ok: false; error: string }

export async function saveSidebarLayout(
  layout: unknown,
): Promise<SidebarActionResult> {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  try {
    await writeSidebarLayout(session.user.id, normalizeSidebarLayout(layout))
  } catch {
    return {
      error: (await getTranslations('nav'))('customizeSaveFailed'),
      ok: false,
    }
  }

  return { ok: true }
}

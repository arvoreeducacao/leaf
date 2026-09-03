import { cookies } from 'next/headers'

import type { SidebarPreferences } from '@/shared/sidebar-preferences'
import {
  parseSidebarPreferences,
  sidebarPreferencesCookie,
} from '@/shared/sidebar-preferences'

export async function readSidebarPreferences(): Promise<SidebarPreferences> {
  const store = await cookies()

  return parseSidebarPreferences(store.get(sidebarPreferencesCookie)?.value)
}

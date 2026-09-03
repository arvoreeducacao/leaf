'use client'

import { useSidebarPreferences } from '@/components/app/sidebar-preferences-provider'
import { limitCollapsedSections } from '@/shared/sidebar-preferences'

export function useSidebarCollapse(id: string | undefined) {
  const { preferences, update } = useSidebarPreferences()
  const collapsed =
    id !== undefined && preferences.collapsedSections.includes(id)

  function toggle() {
    if (id === undefined) {
      return
    }

    update({
      collapsedSections: collapsed
        ? preferences.collapsedSections.filter((item) => item !== id)
        : limitCollapsedSections([...preferences.collapsedSections, id]),
    })
  }

  return { collapsed, toggle }
}

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { saveSidebarLayout } from '@/lib/sidebar-actions'
import type { SidebarLayout, SidebarSectionId } from '@/lib/sidebar-layout'
import { moveSection, toggleSectionVisibility } from '@/lib/sidebar-layout'

export function useSidebarLayout(initial: SidebarLayout) {
  const [layout, setLayout] = useState(initial)
  const [, startTransition] = useTransition()

  function persist(next: SidebarLayout) {
    const previous = layout

    if (next === previous) {
      return
    }

    setLayout(next)

    startTransition(async () => {
      const result = await saveSidebarLayout(next)

      if (!result.ok) {
        setLayout(previous)
        toast.error(result.error)
      }
    })
  }

  return {
    layout,
    moveSectionTo: (id: SidebarSectionId, toIndex: number) =>
      persist(moveSection(layout, id, toIndex)),
    toggleSection: (id: SidebarSectionId) =>
      persist(toggleSectionVisibility(layout, id)),
  }
}

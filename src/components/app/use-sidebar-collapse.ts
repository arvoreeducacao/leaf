'use client'

import { useEffect, useState } from 'react'

import { readStoredValue, writeStoredValue } from '@/shared/storage'

const storageKey = 'leaf:sidebar-sections-collapsed'

function readCollapsedIds() {
  return new Set(readStoredValue<Array<string>>(storageKey, []))
}

export function useSidebarCollapse(id: string | undefined) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (id === undefined) {
      return
    }

    setCollapsed(readCollapsedIds().has(id))
  }, [id])

  function toggle() {
    if (id === undefined) {
      return
    }

    const next = !collapsed
    const ids = readCollapsedIds()

    if (next) {
      ids.add(id)
    } else {
      ids.delete(id)
    }

    writeStoredValue(storageKey, [...ids])
    setCollapsed(next)
  }

  return { collapsed, toggle }
}

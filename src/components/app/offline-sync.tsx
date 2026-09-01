'use client'

import { useEffect } from 'react'

import { syncPendingDocuments } from '@/lib/offline/sync'

export function OfflineSync() {
  useEffect(() => {
    function sync() {
      void syncPendingDocuments()
    }

    sync()
    window.addEventListener('online', sync)

    return () => {
      window.removeEventListener('online', sync)
    }
  }, [])

  return null
}

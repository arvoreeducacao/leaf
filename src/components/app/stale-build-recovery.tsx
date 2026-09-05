'use client'

import { useEffect } from 'react'

import { buildId } from '@/shared/build-id'
import { readSessionFlag, writeSessionFlag } from '@/shared/storage'

const reloadedFor = 'leaf:stale-build-reload'

export function isStaleBuildError(reason: unknown): boolean {
  if (!reason) {
    return false
  }

  const name = (reason as { name?: unknown }).name
  const message = (reason as { message?: unknown }).message

  if (name === 'ChunkLoadError') {
    return true
  }

  if (typeof message !== 'string') {
    return false
  }

  return (
    message.includes('Failed to load chunk') ||
    message.includes('Loading chunk') ||
    message.includes('module factory is not available')
  )
}

export function StaleBuildRecovery() {
  useEffect(() => {
    function recover(reason: unknown) {
      if (!isStaleBuildError(reason)) {
        return
      }

      if (readSessionFlag(reloadedFor) === buildId) {
        return
      }

      writeSessionFlag(reloadedFor, buildId)
      window.location.reload()
    }

    function onRejection(event: PromiseRejectionEvent) {
      recover(event.reason)
    }

    function onError(event: ErrorEvent) {
      recover(event.error ?? event.message)
    }

    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)

    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}

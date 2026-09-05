'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { buildId } from '@/shared/build-id'

const warmablePath = /^\/(doc\/[\w-]+|org)?$/

export function ServiceWorkerRegistration() {
  const pathname = usePathname()
  const warmed = useRef(new Set<string>())

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const register = () => {
      void navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(buildId)}`, {
          scope: '/',
          type: 'module',
        })
        .catch(() => undefined)
    }

    if (document.readyState === 'complete') {
      register()

      return
    }

    window.addEventListener('load', register)

    return () => {
      window.removeEventListener('load', register)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !warmablePath.test(pathname)) {
      return
    }

    const warm = () => {
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'leaf:warm-page',
          url: window.location.href,
        })
      })
    }

    function warmOnHide() {
      if (document.visibilityState === 'hidden') {
        warm()
      }
    }

    if (!warmed.current.has(pathname)) {
      warmed.current.add(pathname)
      warm()
    }

    document.addEventListener('visibilitychange', warmOnHide)

    return () => {
      document.removeEventListener('visibilitychange', warmOnHide)
    }
  }, [pathname])

  return null
}

export async function clearOfflineCaches() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()

  registration?.active?.postMessage({ type: 'leaf:clear-cache' })
}

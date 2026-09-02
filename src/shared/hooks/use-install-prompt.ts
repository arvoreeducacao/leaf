'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import {
  installOfferFor,
  isIosSafari,
  isStandaloneDisplay,
} from '@/lib/pwa/install'
import type { InstallOffer } from '@/lib/pwa/install'

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function promptReadySnapshot() {
  return deferredPrompt !== null
}

function serverSnapshot() {
  return false
}

export function useInstallPrompt() {
  const promptReady = useSyncExternalStore(subscribe, promptReadySnapshot, serverSnapshot)
  const [environment, setEnvironment] = useState({ standalone: true, iosSafari: false })

  useEffect(() => {
    setEnvironment({
      standalone: isStandaloneDisplay(window),
      iosSafari: isIosSafari(navigator.userAgent, navigator.maxTouchPoints),
    })
  }, [])

  const offer: InstallOffer = installOfferFor({ ...environment, promptReady })

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const pending = deferredPrompt

    if (!pending) {
      return 'unavailable'
    }

    await pending.prompt()
    const { outcome } = await pending.userChoice

    if (outcome === 'accepted') {
      deferredPrompt = null
      notify()
    }

    return outcome
  }, [])

  return { offer, install }
}

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { SidebarPreferences } from '@/shared/sidebar-preferences'
import {
  limitCollapsedSections,
  serializeSidebarPreferences,
  sidebarPreferencesCookie,
  sidebarPreferencesCookieMaxAge,
} from '@/shared/sidebar-preferences'
import { readStoredValue } from '@/shared/storage'

type ContextValue = Readonly<{
  preferences: SidebarPreferences
  update: (changes: Partial<SidebarPreferences>) => void
}>

const SidebarPreferencesContext = createContext<ContextValue | null>(null)

const legacyKeys = [
  'leaf:sidebar-collapsed',
  'leaf:sidebar-sections-collapsed',
  'leaf:sidebar-width',
] as const

function persist(preferences: SidebarPreferences) {
  const value = encodeURIComponent(serializeSidebarPreferences(preferences))
  const secure = window.location.protocol === 'https:' ? '; secure' : ''

  document.cookie = `${sidebarPreferencesCookie}=${value}; path=/; max-age=${sidebarPreferencesCookieMaxAge}; samesite=lax${secure}`
}

function takeLegacyPreferences(): Partial<SidebarPreferences> | null {
  if (document.cookie.includes(`${sidebarPreferencesCookie}=`)) {
    return null
  }

  const [collapsedKey, sectionsKey, widthKey] = legacyKeys
  const collapsed = readStoredValue<boolean | null>(collapsedKey, null)
  const collapsedSections = readStoredValue<Array<string> | null>(
    sectionsKey,
    null,
  )
  const width = readStoredValue<number | null>(widthKey, null)

  try {
    for (const key of legacyKeys) {
      window.localStorage.removeItem(key)
    }
  } catch {}

  const changes: Partial<SidebarPreferences> = {}

  if (typeof collapsed === 'boolean') {
    changes.collapsed = collapsed
  }

  if (Array.isArray(collapsedSections)) {
    changes.collapsedSections = limitCollapsedSections(collapsedSections)
  }

  if (typeof width === 'number' && Number.isFinite(width)) {
    changes.width = width
  }

  return Object.keys(changes).length > 0 ? changes : null
}

export function SidebarPreferencesProvider({
  initial,
  children,
}: Readonly<{ initial: SidebarPreferences; children: React.ReactNode }>) {
  const [preferences, setPreferences] = useState(initial)
  const preferencesRef = useRef(preferences)

  preferencesRef.current = preferences

  const update = useCallback((changes: Partial<SidebarPreferences>) => {
    const next = { ...preferencesRef.current, ...changes }

    preferencesRef.current = next
    persist(next)
    setPreferences(next)
  }, [])

  useEffect(() => {
    const legacy = takeLegacyPreferences()

    if (legacy !== null) {
      update(legacy)
    }
  }, [update])

  const value = useMemo(() => ({ preferences, update }), [preferences, update])

  return (
    <SidebarPreferencesContext.Provider value={value}>
      {children}
    </SidebarPreferencesContext.Provider>
  )
}

export function useSidebarPreferences() {
  const value = useContext(SidebarPreferencesContext)

  if (value === null) {
    throw new Error('useSidebarPreferences requires SidebarPreferencesProvider')
  }

  return value
}

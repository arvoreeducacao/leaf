import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { arvoreSsoProviderId, authClient } from '@/lib/auth-client'

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in'

export type SignInOutcome = 'signed-in' | 'cancelled' | 'failed'

type SessionContextValue = Readonly<{
  status: SessionStatus
  signInCount: number
  signIn: () => Promise<SignInOutcome>
  signOut: () => Promise<void>
  sessionDropped: () => Promise<void>
}>

const SessionContext = createContext<SessionContextValue | null>(null)

async function restoreSession(): Promise<SessionStatus> {
  const cookieHeader = await authClient.getCookie()

  return cookieHeader ? 'signed-in' : 'signed-out'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [signInCount, setSignInCount] = useState(0)

  useEffect(() => {
    let active = true

    restoreSession()
      .catch(() => 'signed-out' as const)
      .then((restored) => {
        if (active) {
          setStatus(restored)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (): Promise<SignInOutcome> => {
    const result = await authClient.signIn.social({
      provider: arvoreSsoProviderId,
      callbackURL: '/',
    })

    if (result.error) {
      return 'failed'
    }

    const cookieHeader = await authClient.getCookie()

    if (!cookieHeader) {
      return 'cancelled'
    }

    setSignInCount((count) => count + 1)
    setStatus('signed-in')

    return 'signed-in'
  }, [])

  const sessionDropped = useCallback(async () => {
    setStatus('signed-out')
    await authClient.signOut().catch(() => undefined)
  }, [])

  const signOut = useCallback(async () => {
    await sessionDropped()
  }, [sessionDropped])

  const value = useMemo(
    () => ({ status, signInCount, signIn, signOut, sessionDropped }),
    [status, signInCount, signIn, signOut, sessionDropped],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }

  return context
}

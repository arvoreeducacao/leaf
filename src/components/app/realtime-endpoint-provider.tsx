'use client'

import { createContext, useContext } from 'react'

export type RealtimeEndpoint = Readonly<{ url: string | null; port: number }>

const RealtimeEndpointContext = createContext<RealtimeEndpoint | null>(null)

export function RealtimeEndpointProvider({
  endpoint,
  children,
}: Readonly<{ endpoint: RealtimeEndpoint | null; children: React.ReactNode }>) {
  return (
    <RealtimeEndpointContext.Provider value={endpoint}>
      {children}
    </RealtimeEndpointContext.Provider>
  )
}

export function useRealtimeEndpoint() {
  return useContext(RealtimeEndpointContext)
}

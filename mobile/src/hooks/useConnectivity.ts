import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useState } from 'react'

import { config } from '@/constants/config'

const probeTimeoutMs = 5000

export async function canReachLeaf(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs)

  try {
    const response = await fetch(`${config.leafUrl}${config.connectivityProbePath}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })

    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false)
    })

    return unsubscribe
  }, [])

  const probe = useCallback(() => canReachLeaf(), [])

  return { isConnected, probe }
}

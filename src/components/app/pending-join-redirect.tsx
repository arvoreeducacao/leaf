'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { joinTokenPattern, pendingJoinFlag } from '@/lib/join-link'
import { takeSessionFlag } from '@/shared/storage'

export function PendingJoinRedirect() {
  const router = useRouter()

  useEffect(() => {
    const token = takeSessionFlag(pendingJoinFlag)

    if (token && joinTokenPattern.test(token)) {
      router.replace(`/join/${token}`)
    }
  }, [router])

  return null
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const shownRenders = new Set<string>()

type Props = Readonly<{ renderId: string }>

export function RefreshWhenRestored({ renderId }: Props) {
  const router = useRouter()
  const registered = useRef<string | null>(null)

  useEffect(() => {
    if (registered.current === renderId) {
      return
    }

    registered.current = renderId

    if (shownRenders.has(renderId)) {
      router.refresh()

      return
    }

    shownRenders.add(renderId)
  }, [renderId, router])

  return null
}

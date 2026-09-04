'use client'

import { useEffect } from 'react'

import type { ActiveTrail as Trail } from '@/components/app/active-trail-bridge'
import { registerActiveTrail } from '@/components/app/active-trail-bridge'

export function ActiveTrail({ trail }: Readonly<{ trail: Trail }>) {
  useEffect(() => {
    registerActiveTrail(trail)

    return () => registerActiveTrail(null)
  }, [trail])

  return null
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useSidebarPreferences } from '@/components/app/sidebar-preferences-provider'
import {
  defaultSidebarWidth,
  minSidebarWidth,
  sidebarMaxWidthRatio,
} from '@/shared/sidebar-preferences'

const keyboardStep = 16

function viewportMaxWidth() {
  if (typeof window === 'undefined') {
    return defaultSidebarWidth
  }

  return Math.max(
    minSidebarWidth,
    Math.round(window.innerWidth * sidebarMaxWidthRatio),
  )
}

function clampWidth(value: number, maxWidth: number) {
  return Math.min(Math.max(Math.round(value), minSidebarWidth), maxWidth)
}

export function useSidebarWidth() {
  const { preferences, update } = useSidebarPreferences()
  const [maxWidth, setMaxWidth] = useState(() =>
    Math.max(minSidebarWidth, preferences.width),
  )
  const [resizing, setResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const width = clampWidth(preferences.width, maxWidth)
  const widthRef = useRef(width)

  widthRef.current = width

  useEffect(() => {
    setMaxWidth(viewportMaxWidth())

    function handleViewportResize() {
      setMaxWidth(viewportMaxWidth())
    }

    window.addEventListener('resize', handleViewportResize)

    return () => window.removeEventListener('resize', handleViewportResize)
  }, [])

  useEffect(() => {
    if (!resizing) {
      return
    }

    const { body } = document
    const previousCursor = body.style.cursor
    const previousUserSelect = body.style.userSelect

    body.style.cursor = 'col-resize'
    body.style.userSelect = 'none'

    return () => {
      body.style.cursor = previousCursor
      body.style.userSelect = previousUserSelect
    }
  }, [resizing])

  const store = useCallback(
    (value: number) => update({ width: clampWidth(value, viewportMaxWidth()) }),
    [update],
  )

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()

      const handle = event.currentTarget
      const { pointerId } = event
      const startX = event.clientX
      const startWidth = widthRef.current
      const limit = viewportMaxWidth()

      function handleMove(moveEvent: PointerEvent) {
        const next = clampWidth(startWidth + moveEvent.clientX - startX, limit)

        if (next === widthRef.current) {
          return
        }

        widthRef.current = next

        if (sidebarRef.current !== null) {
          sidebarRef.current.style.width = `${next}px`
        }

        handle.setAttribute('aria-valuenow', String(next))
      }

      function handleEnd() {
        handle.removeEventListener('pointermove', handleMove)
        handle.removeEventListener('pointerup', handleEnd)
        handle.removeEventListener('pointercancel', handleEnd)

        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId)
        }

        setResizing(false)
        update({ width: widthRef.current })
      }

      handle.setPointerCapture(pointerId)
      handle.addEventListener('pointermove', handleMove)
      handle.addEventListener('pointerup', handleEnd)
      handle.addEventListener('pointercancel', handleEnd)
      setResizing(true)
    },
    [update],
  )

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const steps: Record<string, number> = {
        ArrowLeft: widthRef.current - keyboardStep,
        ArrowRight: widthRef.current + keyboardStep,
        End: viewportMaxWidth(),
        Home: minSidebarWidth,
      }
      const next = steps[event.key]

      if (next === undefined) {
        return
      }

      event.preventDefault()
      store(next)
    },
    [store],
  )

  const resetWidth = useCallback(() => store(defaultSidebarWidth), [store])

  return {
    handleResizeKeyDown,
    maxWidth,
    minWidth: minSidebarWidth,
    resetWidth,
    resizing,
    sidebarRef,
    startResize,
    width,
  }
}

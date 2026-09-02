'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { readStoredValue, writeStoredValue } from '@/shared/storage'

const storageKey = 'leaf:sidebar-width'
const defaultWidth = 240
const minWidth = 180
const maxWidthRatio = 0.25
const keyboardStep = 16

function viewportMaxWidth() {
  if (typeof window === 'undefined') {
    return defaultWidth
  }

  return Math.max(minWidth, Math.round(window.innerWidth * maxWidthRatio))
}

function clampWidth(value: number, maxWidth: number) {
  return Math.min(Math.max(Math.round(value), minWidth), maxWidth)
}

export function useSidebarWidth() {
  const [preferredWidth, setPreferredWidth] = useState(defaultWidth)
  const [maxWidth, setMaxWidth] = useState(defaultWidth)
  const [resizing, setResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const width = clampWidth(preferredWidth, maxWidth)
  const widthRef = useRef(width)

  widthRef.current = width

  useEffect(() => {
    setMaxWidth(viewportMaxWidth())
    setPreferredWidth(readStoredValue(storageKey, defaultWidth))

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

  const store = useCallback((value: number) => {
    const next = clampWidth(value, viewportMaxWidth())

    setPreferredWidth(next)
    writeStoredValue(storageKey, next)
  }, [])

  const startResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const handle = event.currentTarget
    const { pointerId } = event
    const startX = event.clientX
    const startWidth = widthRef.current
    const limit = viewportMaxWidth()

    let pendingWidth = startWidth
    let frame = 0

    function paint() {
      frame = 0
      widthRef.current = pendingWidth

      if (sidebarRef.current !== null) {
        sidebarRef.current.style.width = `${pendingWidth}px`
      }

      handle.setAttribute('aria-valuenow', String(pendingWidth))
    }

    function handleMove(moveEvent: PointerEvent) {
      pendingWidth = clampWidth(startWidth + moveEvent.clientX - startX, limit)

      if (frame === 0) {
        frame = window.requestAnimationFrame(paint)
      }
    }

    function handleEnd() {
      handle.removeEventListener('pointermove', handleMove)
      handle.removeEventListener('pointerup', handleEnd)
      handle.removeEventListener('pointercancel', handleEnd)

      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
        paint()
      }

      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId)
      }

      setResizing(false)
      setPreferredWidth(pendingWidth)
      writeStoredValue(storageKey, pendingWidth)
    }

    handle.setPointerCapture(pointerId)
    handle.addEventListener('pointermove', handleMove)
    handle.addEventListener('pointerup', handleEnd)
    handle.addEventListener('pointercancel', handleEnd)
    setResizing(true)
  }, [])

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const steps: Record<string, number> = {
        ArrowLeft: widthRef.current - keyboardStep,
        ArrowRight: widthRef.current + keyboardStep,
        End: viewportMaxWidth(),
        Home: minWidth,
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

  const resetWidth = useCallback(() => store(defaultWidth), [store])

  return {
    handleResizeKeyDown,
    maxWidth,
    minWidth,
    resetWidth,
    resizing,
    sidebarRef,
    startResize,
    width,
  }
}

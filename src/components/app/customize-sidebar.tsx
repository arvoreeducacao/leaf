'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { sidebarHeading } from '@/components/app/sidebar-styles'
import { EyeIcon, EyeOffIcon, GripIcon } from '@/components/icons/outline'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import type { SidebarLayout, SidebarSectionId } from '@/lib/sidebar-layout'
import { isSectionHidden } from '@/lib/sidebar-layout'
import { cn } from '@/shared/utils'

export type CustomizableSection = Readonly<{
  id: SidebarSectionId
  title: string
}>

type Props = Readonly<{
  layout: SidebarLayout
  sections: ReadonlyArray<CustomizableSection>
  onMove: (id: SidebarSectionId, toIndex: number) => void
  onToggle: (id: SidebarSectionId) => void
  onDone: () => void
}>

function previewOrder(
  sections: ReadonlyArray<CustomizableSection>,
  from: number,
  to: number,
) {
  const preview = [...sections]
  const [held] = preview.splice(from, 1)

  preview.splice(to, 0, held)

  return preview
}

export function CustomizeSidebar({
  layout,
  sections,
  onMove,
  onToggle,
  onDone,
}: Props) {
  const t = useTranslations('nav')
  const listRef = useRef<HTMLUListElement>(null)
  const detachDragRef = useRef<(() => void) | null>(null)
  const [dragging, setDragging] = useState<{
    id: SidebarSectionId
    to: number
  } | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => () => detachDragRef.current?.(), [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      event.stopPropagation()
      onDone()
    }

    document.addEventListener('keydown', handleEscape, true)

    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [onDone])

  const draggingFrom = dragging
    ? sections.findIndex((section) => section.id === dragging.id)
    : -1
  const rows =
    dragging && draggingFrom >= 0
      ? previewOrder(sections, draggingFrom, dragging.to)
      : sections

  function commit(id: SidebarSectionId, to: number, announce: boolean) {
    const target = sections[to]

    if (!target || target.id === id) {
      return
    }

    onMove(id, layout.order.indexOf(target.id))

    if (announce) {
      const moved = sections.find((section) => section.id === id)

      setStatus(
        t('sectionMoved', {
          position: to + 1,
          title: moved?.title ?? '',
          total: sections.length,
        }),
      )
    }
  }

  function startDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    id: SidebarSectionId,
    from: number,
  ) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const centers = [...(listRef.current?.children ?? [])].map((row) => {
      const rect = row.getBoundingClientRect()

      return rect.top + rect.height / 2
    })
    let to = from

    function handleMove(moveEvent: PointerEvent) {
      const crossed = centers.findIndex((center) => moveEvent.clientY < center)
      const next = crossed < 0 ? centers.length - 1 : crossed

      if (next !== to) {
        to = next
        setDragging({ id, to: next })
      }
    }

    function detach() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      detachDragRef.current = null
    }

    function handleEnd() {
      detach()
      setDragging(null)
      commit(id, to, false)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    detachDragRef.current = detach
    setDragging({ id, to: from })
  }

  function moveByKeyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    id: SidebarSectionId,
    from: number,
  ) {
    const steps: Record<string, number> = {
      ArrowDown: from + 1,
      ArrowUp: from - 1,
    }
    const to = steps[event.key]

    if (to === undefined) {
      return
    }

    event.preventDefault()
    commit(id, to, true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-col">
        <h2 className={sidebarHeading}>{t('customizeTitle')}</h2>
        <p className="px-2 pb-1 text-caption text-content-subtle">
          {t('customizeHint')}
        </p>
      </div>

      <ul className="flex flex-col" ref={listRef}>
        {rows.map((section) => {
          const hidden = isSectionHidden(layout, section.id)
          const index = sections.findIndex((item) => item.id === section.id)

          return (
            <li
              className={cn(
                'flex h-11 items-center gap-1 rounded-large pr-0.5 pl-0.5 tablet:h-8',
                dragging?.id === section.id
                  ? 'bg-surface-active'
                  : 'hover:bg-surface-hover',
              )}
              key={section.id}
            >
              <button
                aria-label={t('reorderSection', { title: section.title })}
                className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-small text-content-subtle transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 tablet:size-7"
                onKeyDown={(event) =>
                  moveByKeyboard(event, section.id, index)
                }
                onPointerDown={(event) => startDrag(event, section.id, index)}
                type="button"
              >
                <GripIcon aria-hidden="true" className="size-3.5" />
              </button>

              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-body-small text-content',
                  hidden && 'text-content-disabled',
                )}
              >
                {section.title}
              </span>

              <ButtonIcon
                aria-label={
                  hidden
                    ? t('showSection', { title: section.title })
                    : t('hideSection', { title: section.title })
                }
                aria-pressed={hidden}
                onClick={() => onToggle(section.id)}
                size="medium"
                variant="ghost"
              >
                {hidden ? (
                  <EyeOffIcon aria-hidden="true" />
                ) : (
                  <EyeIcon aria-hidden="true" />
                )}
              </ButtonIcon>
            </li>
          )
        })}
      </ul>

      <span aria-live="polite" className="sr-only" role="status">
        {status}
      </span>

      <Button className="mt-auto w-full" onClick={onDone} type="button">
        {t('customizeDone')}
      </Button>
    </div>
  )
}

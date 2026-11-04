'use client'

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { useTranslations } from 'next-intl'
import {
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
} from 'react'

import type { DropSide } from '@/lib/database/views'
import { cn } from '@/shared/utils'

export const columnSlide = {
  duration: 200,
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
}

export function columnShift(propertyId: string) {
  return `var(--column-shift-${propertyId}, 0px) 0`
}

export function columnMotion(movingId: string | null, propertyId: string) {
  return movingId === propertyId ? 'column-lifted' : 'column-slide'
}

type Column = Readonly<{ id: string; name: string }>

export function SortableColumns({
  columns,
  enabled,
  onMove,
  onMovingChange,
  children,
}: Readonly<{
  columns: ReadonlyArray<Column>
  enabled: boolean
  onMove: (propertyId: string, targetId: string, side: DropSide) => void
  onMovingChange: (propertyId: string | null) => void
  children: ReactNode
}>) {
  const t = useTranslations('database')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )
  const ids = columns.map((column) => column.id)

  function nameOf(id: string | number | undefined) {
    return columns.find((column) => column.id === id)?.name ?? ''
  }

  if (!enabled) {
    return children
  }

  return (
    <DndContext
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            t('columnDragStart', { name: nameOf(active.id) }),
          onDragOver: ({ active, over }) =>
            over
              ? t('columnDragOver', {
                  name: nameOf(active.id),
                  target: nameOf(over.id),
                })
              : undefined,
          onDragEnd: ({ active }) =>
            t('columnDragEnd', { name: nameOf(active.id) }),
          onDragCancel: ({ active }) =>
            t('columnDragCancel', { name: nameOf(active.id) }),
        },
      }}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragCancel={() => onMovingChange(null)}
      onDragEnd={({ active, over }: DragEndEvent) => {
        onMovingChange(null)

        if (!over || active.id === over.id) {
          return
        }

        const from = ids.indexOf(String(active.id))
        const to = ids.indexOf(String(over.id))

        onMove(String(active.id), String(over.id), to > from ? 'after' : 'before')
      }}
      onDragStart={({ active }: DragStartEvent) =>
        onMovingChange(String(active.id))
      }
      sensors={sensors}
    >
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function SortableColumnHeader({
  propertyId,
  table,
  disabled,
  movingId,
  className,
  onFocusCapture,
  onBlurCapture,
  children,
}: Readonly<{
  propertyId: string
  table: RefObject<HTMLTableElement | null>
  disabled: boolean
  movingId: string | null
  className: string
  onFocusCapture: (event: FocusEvent<HTMLTableCellElement>) => void
  onBlurCapture: (event: FocusEvent<HTMLTableCellElement>) => void
  children: ReactNode
}>) {
  const { setNodeRef, listeners, transform } = useSortable({
    id: propertyId,
    disabled,
    transition: columnSlide,
  })
  const shift = transform?.x ?? 0

  useLayoutEffect(() => {
    table.current?.style.setProperty(
      `--column-shift-${propertyId}`,
      `${shift}px`,
    )
  }, [shift, propertyId, table])

  useLayoutEffect(() => {
    const element = table.current

    return () => {
      element?.style.removeProperty(`--column-shift-${propertyId}`)
    }
  }, [propertyId, table])

  return (
    <th
      className={cn(
        className,
        !disabled && 'cursor-grab active:cursor-grabbing',
        columnMotion(movingId, propertyId),
      )}
      onBlurCapture={onBlurCapture}
      onFocusCapture={onFocusCapture}
      ref={setNodeRef}
      scope="col"
      style={{ translate: columnShift(propertyId) }}
      {...(disabled ? {} : listeners)}
    >
      {children}
    </th>
  )
}

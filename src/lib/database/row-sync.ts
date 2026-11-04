import type { PropertyValue } from './values'

export const ROW_CHANGED_EVENT = 'leaf:row-changed'

export type RowChange = Readonly<{
  rowId: string
  title?: string
  values?: Readonly<Record<string, PropertyValue>>
}>

export function announceRowChange(change: RowChange) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(ROW_CHANGED_EVENT, { detail: change }))
}

export function readRowChange(event: Event): RowChange | null {
  if (!(event instanceof CustomEvent)) {
    return null
  }

  const detail: unknown = event.detail

  return typeof detail === 'object' &&
    detail !== null &&
    typeof (detail as RowChange).rowId === 'string'
    ? (detail as RowChange)
    : null
}

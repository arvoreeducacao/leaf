import type { DatabaseViewType } from '@/db/schema'

import {
  BoardLayoutIcon,
  CalendarLayoutIcon,
  FormLayoutIcon,
  GalleryLayoutIcon,
  ListLayoutIcon,
  TableLayoutIcon,
  TimelineLayoutIcon,
} from './icons'

export const layoutIcon: Record<DatabaseViewType, typeof TableLayoutIcon> = {
  table: TableLayoutIcon,
  board: BoardLayoutIcon,
  timeline: TimelineLayoutIcon,
  calendar: CalendarLayoutIcon,
  list: ListLayoutIcon,
  gallery: GalleryLayoutIcon,
  form: FormLayoutIcon,
}

export const layoutOrder: ReadonlyArray<DatabaseViewType> = [
  'table',
  'board',
  'timeline',
  'calendar',
  'list',
  'gallery',
]

export const createOrder: ReadonlyArray<DatabaseViewType> = [
  ...layoutOrder,
  'form',
]

export const scheduleLayouts: ReadonlyArray<DatabaseViewType> = [
  'calendar',
  'timeline',
]

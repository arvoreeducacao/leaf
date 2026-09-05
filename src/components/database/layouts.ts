import type { DatabaseViewType } from '@/db/schema'

import {
  BoardLayoutIcon,
  CalendarLayoutIcon,
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
}

export const layoutOrder: ReadonlyArray<DatabaseViewType> = [
  'table',
  'board',
  'timeline',
  'calendar',
  'list',
  'gallery',
]

export const scheduleLayouts: ReadonlyArray<DatabaseViewType> = [
  'calendar',
  'timeline',
]

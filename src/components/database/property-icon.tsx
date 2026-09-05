import type { DatabasePropertyType } from '@/db/schema'
import {
  BadgeIDIcon,
  CalculatorIcon,
  CalendarIcon,
  ChartPieIcon,
  CheckSquareIcon,
  FormatTextIcon,
  ListIcon,
  TagIcon,
  UsersIcon,
  WorldIcon,
} from '@/components/icons'

type IconComponent = typeof FormatTextIcon

const iconByType: Record<DatabasePropertyType, IconComponent> = {
  text: FormatTextIcon,
  number: CalculatorIcon,
  select: TagIcon,
  multiSelect: ListIcon,
  date: CalendarIcon,
  checkbox: CheckSquareIcon,
  url: WorldIcon,
  person: UsersIcon,
  status: ChartPieIcon,
  uniqueId: BadgeIDIcon,
}

type Props = Readonly<{ type: DatabasePropertyType; className?: string }>

export function PropertyIcon({ type, className = 'size-4' }: Props) {
  const Icon = iconByType[type]

  return <Icon aria-hidden="true" className={className} />
}

import type { DatabasePropertyType } from '@/db/schema'

import {
  CheckboxTypeIcon,
  DateTypeIcon,
  FilesTypeIcon,
  MultiSelectTypeIcon,
  NumberTypeIcon,
  PersonTypeIcon,
  SelectTypeIcon,
  StatusTypeIcon,
  TextTypeIcon,
  UniqueIdTypeIcon,
  UrlTypeIcon,
} from './icons'

type IconComponent = typeof TextTypeIcon

const iconByType: Record<DatabasePropertyType, IconComponent> = {
  text: TextTypeIcon,
  number: NumberTypeIcon,
  select: SelectTypeIcon,
  multiSelect: MultiSelectTypeIcon,
  date: DateTypeIcon,
  checkbox: CheckboxTypeIcon,
  url: UrlTypeIcon,
  person: PersonTypeIcon,
  status: StatusTypeIcon,
  uniqueId: UniqueIdTypeIcon,
  files: FilesTypeIcon,
}

type Props = Readonly<{ type: DatabasePropertyType; className?: string }>

export function PropertyIcon({ type, className = 'size-5' }: Props) {
  const Icon = iconByType[type]

  return <Icon aria-hidden="true" className={className} />
}

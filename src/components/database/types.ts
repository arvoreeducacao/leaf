import type { DatabasePropertyType } from '@/db/schema'
import type { PropertyValue, SelectOption } from '@/lib/database/values'

export type DatabaseHandlers = Readonly<{
  commitValue: (
    rowId: string,
    propertyId: string,
    value: PropertyValue,
  ) => void
  renameRow: (rowId: string, title: string) => void
  createRow: (
    seed?: Readonly<Record<string, PropertyValue>>,
    templateId?: string | null,
  ) => void
  deleteRow: (rowId: string) => void
  createOption: (
    propertyId: string,
    name: string,
  ) => Promise<SelectOption | null>
  addProperty: (type: DatabasePropertyType) => void
  renameProperty: (propertyId: string, name: string) => void
  changePropertyType: (propertyId: string, type: DatabasePropertyType) => void
  changeUniqueIdPrefix: (propertyId: string, prefix: string) => void
  hideProperty: (propertyId: string) => void
  deleteProperty: (propertyId: string) => void
}>

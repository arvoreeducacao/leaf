'use client'

import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DatabaseProperty } from '@/db/schema'
import { TITLE_PROPERTY_ID, foldText } from '@/lib/database/views'

import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  placeholder: string
  titleLabel: string
  properties: ReadonlyArray<DatabaseProperty>
  disabled?: boolean
  onPick: (propertyId: string) => void
  children: React.ReactNode
}>

export function PropertyPicker({
  placeholder,
  titleLabel,
  properties,
  disabled = false,
  onPick,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const targets = useMemo(() => {
    const all = [
      { id: TITLE_PROPERTY_ID, name: titleLabel, type: null },
      ...properties.map((property) => ({
        id: property.id,
        name: property.name,
        type: property.type,
      })),
    ]
    const needle = foldText(query)

    return needle.length === 0
      ? all
      : all.filter((target) => foldText(target.name).includes(needle))
  }, [properties, query, titleLabel])

  function pick(propertyId: string) {
    setOpen(false)
    setQuery('')
    onPick(propertyId)
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next)

        if (!next) {
          setQuery('')
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-70 p-1.5">
        <Input
          aria-label={placeholder}
          autoFocus
          className="h-9 text-body-small tablet:h-7"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
        <ul className="mt-1.5 flex max-h-64 flex-col overflow-y-auto">
          {targets.map((target) => (
            <li key={target.id}>
              <button
                className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-medium px-2 text-left text-body-small text-content-strong transition-colors tablet:h-7 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                onClick={() => pick(target.id)}
                type="button"
              >
                <PropertyIcon
                  className="size-4 shrink-0 text-content-subtle"
                  type={target.type ?? 'text'}
                />
                <span className="min-w-0 truncate">{target.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

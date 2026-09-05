'use client'

import { useEffect, useRef, useState } from 'react'

import { SearchIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'

type Props = Readonly<{
  value: string
  placeholder: string
  onChange: (value: string) => void
}>

export function ViewSearch({ value, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      field.current?.focus()
    }
  }, [open])

  if (!open && value.length === 0) {
    return (
      <ButtonIcon
        aria-label={placeholder}
        onClick={() => setOpen(true)}
        size="medium"
        variant="ghost"
      >
        <SearchIcon aria-hidden="true" />
      </ButtonIcon>
    )
  }

  return (
    <span className="flex h-9 items-center gap-1.5 pl-1.5 tablet:h-7">
      <SearchIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-content-subtle"
      />
      <input
        aria-label={placeholder}
        className="h-full w-40 min-w-0 bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-subtle"
        onBlur={() => {
          if (value.length === 0) {
            setOpen(false)
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        ref={field}
        type="text"
        value={value}
      />
    </span>
  )
}

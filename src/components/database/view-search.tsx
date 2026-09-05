'use client'

import { useEffect, useRef, useState } from 'react'

import { CancelIcon, SearchIcon } from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'

type Props = Readonly<{
  value: string
  placeholder: string
  clearLabel: string
  onChange: (value: string) => void
}>

export function ViewSearch({
  value,
  placeholder,
  clearLabel,
  onChange,
}: Props) {
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
    <span className="relative inline-flex items-center">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-2 size-3.5 text-content-subtle"
      />
      <input
        aria-label={placeholder}
        className="h-9 w-44 rounded-large border border-line-strong bg-surface-card pr-7 pl-7 text-body-small text-content-strong outline-none transition-colors tablet:h-7 placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
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
      {value.length > 0 ? (
        <ButtonIcon
          aria-label={clearLabel}
          className="absolute right-0.5"
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
          size="small"
          variant="ghost"
        >
          <CancelIcon aria-hidden="true" />
        </ButtonIcon>
      ) : null}
    </span>
  )
}

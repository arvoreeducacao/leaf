'use client'

import { useEffect, useRef, useState } from 'react'

import { ButtonIcon } from '@/components/ui/button-icon'

import { CloseIcon, SearchIcon } from './icons'

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

  function close() {
    onChange('')
    setOpen(false)
  }

  if (!open && value.length === 0) {
    return (
      <ButtonIcon
        aria-label={placeholder}
        className="relative size-9 rounded-large p-1.5 tablet:size-6 tablet:p-1 [&_svg]:size-4"
        onClick={() => setOpen(true)}
        size="medium"
        variant="ghost"
      >
        <SearchIcon aria-hidden="true" />
      </ButtonIcon>
    )
  }

  return (
    <span className="flex h-9 items-center gap-1.5 rounded-large px-1.5 tablet:h-7">
      <SearchIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-content-subtle"
      />
      <input
        aria-label={placeholder}
        className="h-full w-40 min-w-0 bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-tertiary"
        onBlur={() => {
          if (value.length === 0) {
            setOpen(false)
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            close()
          }
        }}
        placeholder={placeholder}
        ref={field}
        type="text"
        value={value}
      />
      <ButtonIcon
        aria-label={placeholder}
        className="size-5 rounded-medium p-0.5 [&_svg]:size-3.5"
        onClick={close}
        size="small"
        variant="ghost"
      >
        <CloseIcon aria-hidden="true" />
      </ButtonIcon>
    </span>
  )
}

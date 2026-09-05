'use client'

import type { ReactNode } from 'react'

import { cn } from '@/shared/utils'

type Props = Readonly<{
  value: string
  placeholder: string
  onChange: (value: string) => void
  ariaLabel: string
  className: string
  disabled?: boolean
  maxLength?: number
  multiline?: boolean
  solidPlaceholder?: boolean
  suffix?: ReactNode
}>

export function InlineText({
  value,
  placeholder,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  maxLength,
  multiline = false,
  solidPlaceholder = false,
  suffix,
}: Props) {
  const shown = value.length > 0 ? value : placeholder

  return (
    <div className="relative w-full">
      <div
        aria-hidden="true"
        className={cn(
          'whitespace-pre-wrap break-words p-0 text-transparent',
          className,
        )}
      >
        {shown}
        {suffix}
        {'​'}
      </div>

      <textarea
        aria-label={ariaLabel}
        className={cn(
          'absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none disabled:cursor-default',
          solidPlaceholder
            ? 'placeholder:text-inherit'
            : 'placeholder:text-content-disabled',
          className,
        )}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(
            multiline
              ? event.target.value
              : event.target.value.replace(/[\r\n]+/g, ' '),
          )
        }
        onKeyDown={(event) => {
          if (!multiline && event.key === 'Enter') {
            event.preventDefault()
          }
        }}
        placeholder={placeholder}
        rows={1}
        value={value}
      />
    </div>
  )
}

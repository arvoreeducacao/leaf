'use client'

import { cn } from '@/shared/utils'

type Option = Readonly<{ value: string; label: string }>

type Props = Readonly<{
  label: string
  value: string
  options: ReadonlyArray<Option>
  onChange: (value: string) => void
  className?: string
}>

export function FieldSelect({
  label,
  value,
  options,
  onChange,
  className,
}: Props) {
  return (
    <select
      aria-label={label}
      className={cn(
        'h-9 min-w-0 cursor-pointer rounded-medium border border-line-strong bg-surface-card px-2 text-body-small text-content-strong outline-none transition-colors hover:border-line-contrast focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
        className,
      )}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

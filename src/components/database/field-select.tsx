'use client'

import { CaretDownIcon } from '@/components/icons'
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
    <span className={cn('relative inline-flex min-w-0 items-center', className)}>
      <select
        aria-label={label}
        className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-medium border border-line bg-surface-card py-0 pr-7 pl-2 text-body-small text-content-strong outline-none transition-colors tablet:h-7 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-2 size-3.5 text-content-subtle"
      />
    </span>
  )
}

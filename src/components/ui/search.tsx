'use client'

import type * as React from 'react'

import { CancelIcon, SearchIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

const searchVariants = {
  'primary-desktop': 'rounded-xlarge border border-gray-200',
  'secondary-desktop': 'rounded-large border border-transparent',
  mobile: 'rounded-large border border-transparent',
} as const

type SearchVariant = keyof typeof searchVariants

type SearchProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  variant?: SearchVariant
  onClear?: () => void
  showClear?: boolean
}

function Search({
  className,
  variant = 'secondary-desktop',
  value,
  onClear,
  showClear,
  ...props
}: Readonly<SearchProps>) {
  const iconRight = variant === 'primary-desktop'
  const hasValue = value !== undefined && value !== null && value !== ''
  const displayClear = (showClear ?? hasValue) && Boolean(onClear)

  return (
    <div
      className={cn(
        'flex h-11 w-full items-center gap-2 bg-muted px-4 text-base text-gray-700 transition-colors focus-within:outline-2 focus-within:outline-gray-900 focus-within:outline-offset-2 tablet:h-10',
        searchVariants[variant],
        className
      )}
    >
      {!iconRight && (
        <SearchIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-gray-600"
        />
      )}
      <input
        className="h-full w-full bg-transparent outline-none placeholder:text-gray-700 [&::-webkit-search-cancel-button]:appearance-none"
        type="search"
        value={value}
        {...props}
      />
      {iconRight && (
        <SearchIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-gray-600"
        />
      )}
      {displayClear && (
        <button
          aria-label="Limpar busca"
          className="-mr-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-large text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-gray-900 focus-visible:outline-offset-2"
          onClick={onClear}
          type="button"
        >
          <CancelIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

export type { SearchProps, SearchVariant }
export { Search }

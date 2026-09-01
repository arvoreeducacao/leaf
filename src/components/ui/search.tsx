'use client'

import { useTranslations } from 'next-intl'
import type * as React from 'react'

import { CancelIcon, FilterIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

const searchVariants = {
  'primary-desktop': '',
  'secondary-desktop': '',
  mobile: '',
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
  const tCommon = useTranslations('common')
  const hasValue = value !== undefined && value !== null && value !== ''
  const displayClear = (showClear ?? hasValue) && Boolean(onClear)

  return (
    <div
      className={cn(
        'flex h-11 w-full items-center gap-1.5 rounded-large px-1.5 text-body-small text-content-strong transition-colors hover:bg-surface-hover focus-within:bg-surface-subtle tablet:h-7',
        searchVariants[variant],
        className
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <FilterIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-content-subtle"
        />
      </span>
      <input
        className="h-full w-full bg-transparent outline-none placeholder:text-content-disabled [&::-webkit-search-cancel-button]:appearance-none"
        type="search"
        value={value}
        {...props}
      />
      {displayClear && (
        <button
          aria-label={tCommon('clearSearch')}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-small text-content-subtle transition-colors hover:bg-surface-active hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
          onClick={onClear}
          type="button"
        >
          <CancelIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export type { SearchProps, SearchVariant }
export { Search }

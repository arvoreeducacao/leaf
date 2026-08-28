import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { CancelIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-pill border px-2 py-1 font-bold text-sm leading-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-[14px]',
  {
    variants: {
      variant: {
        more: 'border-gray-200 bg-gray-200 text-gray-900',
        info: 'border-gray-200 bg-muted text-gray-700',
        warning: 'border-warning-200 bg-warning-200 text-gray-900',
        caution: 'border-error-200 bg-error-200 text-gray-900',
        success: 'border-success-200 bg-success-200 text-gray-900',
        default: 'border-gray-200 bg-gray-200 text-gray-900',
        secondary: 'border-gray-200 bg-muted text-gray-700',
        destructive: 'border-error-200 bg-error-200 text-gray-900',
        outline: 'border-gray-400 bg-transparent text-gray-700',
        activity:
          'border-transparent bg-muted text-gray-700 [&>svg]:text-gray-600',
        degree: 'border-gray-400 bg-transparent text-gray-700',
        status: 'border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: Readonly<
  React.ComponentProps<'span'> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean }
>) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      className={cn(badgeVariants({ variant }), className)}
      data-slot="badge"
      {...props}
    />
  )
}

export { Badge, badgeVariants }

function EditableTag({
  className,
  children,
  onRemove,
  removeLabel = 'Remover',
  variant = 'dark',
  ...props
}: Readonly<
  Omit<React.ComponentProps<'span'>, 'children'> & {
    children: React.ReactNode
    onRemove?: () => void
    removeLabel?: string
    variant?: 'dark' | 'light'
  }
>) {
  const isLight = variant === 'light'
  return (
    <span
      className={cn(
        'inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-pill border px-2 py-1 font-bold text-[14px] leading-none',
        isLight ? 'border-white text-white' : 'border-gray-400 text-gray-700',
        className
      )}
      data-slot="editable-tag"
      {...props}
    >
      {children}
      <button
        aria-label={`${removeLabel}: ${typeof children === 'string' ? children : ''}`.trim()}
        className="-mr-0.5 inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRemove}
        type="button"
      >
        <CancelIcon className="size-3.5" />
      </button>
    </span>
  )
}

export { EditableTag }

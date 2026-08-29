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
        more: 'border-line-soft bg-surface-hover text-content-strong',
        info: 'border-line-soft bg-muted text-content',
        warning: 'border-warn-surface-strong bg-warn-surface-strong text-content-strong',
        caution: 'border-danger-surface-strong bg-danger-surface-strong text-content-strong',
        success: 'border-positive-surface-strong bg-positive-surface-strong text-content-strong',
        default: 'border-line-soft bg-surface-hover text-content-strong',
        secondary: 'border-line-soft bg-muted text-content',
        destructive: 'border-danger-surface-strong bg-danger-surface-strong text-content-strong',
        outline: 'border-line-strong bg-transparent text-content',
        activity:
          'border-transparent bg-muted text-content [&>svg]:text-content-muted',
        degree: 'border-line-strong bg-transparent text-content',
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
        isLight ? 'border-content-inverse text-content-inverse' : 'border-line-strong text-content',
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

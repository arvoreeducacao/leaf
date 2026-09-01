import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { CancelIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-small border px-1.5 font-medium text-caption leading-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        more: 'border-transparent bg-surface-subtle text-content',
        info: 'border-transparent bg-surface-subtle text-content',
        warning: 'border-transparent bg-warn-surface text-warn',
        caution: 'border-transparent bg-danger-surface text-danger',
        success: 'border-transparent bg-positive-surface-strong text-positive',
        default: 'border-transparent bg-surface-subtle text-content',
        secondary: 'border-transparent bg-surface-subtle text-content',
        destructive: 'border-transparent bg-danger-surface text-danger',
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
        'inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-small border px-1.5 font-medium text-caption leading-none',
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

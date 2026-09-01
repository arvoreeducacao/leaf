import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/shared/utils'

const buttonIconVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-600 disabled:bg-surface-subtle disabled:text-content-disabled',
        secondary:
          'border-line-strong bg-surface-card text-content-strong hover:bg-surface-hover disabled:bg-transparent disabled:text-content-disabled',
        'secondary-reverse':
          'border-content-inverse bg-transparent text-content-inverse hover:bg-surface-hover disabled:bg-transparent disabled:text-content-disabled',
        caution:
          'bg-danger-solid text-white hover:bg-danger-solid-hover disabled:bg-surface-subtle disabled:text-content-disabled',
        ghost:
          'text-content-subtle hover:bg-surface-hover hover:text-content-strong disabled:bg-transparent disabled:text-content-disabled',
        'filter-active':
          'border-line-contrast bg-surface-card text-content-strong hover:bg-surface-hover disabled:border-transparent disabled:bg-surface-subtle disabled:text-content-disabled',
      },
      size: {
        small: 'size-6 rounded-small p-0.5 [&_svg]:size-3.5',
        medium: 'size-9 rounded-large p-1.5 tablet:size-7 [&_svg]:size-4',
        large: 'size-10 rounded-large p-2 tablet:size-8 [&_svg]:size-4',
        xlarge: 'size-11 rounded-large p-2.5 tablet:size-10 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'medium',
    },
  }
)

function ButtonIcon({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: Readonly<
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonIconVariants> & {
      asChild?: boolean
      'aria-label': string
    }
>) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonIconVariants({ variant, size, className }))}
      data-slot="button-icon"
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  )
}

export { ButtonIcon, buttonIconVariants }

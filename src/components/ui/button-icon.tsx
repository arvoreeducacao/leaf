import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/shared/utils'

const buttonIconVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border border-transparent outline-none transition-all before:absolute before:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-600 disabled:bg-muted disabled:text-content-disabled',
        secondary:
          'border-line-strong bg-surface-card text-content hover:border-line-contrast hover:text-content-strong disabled:bg-muted disabled:text-content-disabled',
        'secondary-reverse':
          'border-content-inverse bg-transparent text-content-inverse hover:border-content-inverse/80 disabled:bg-muted disabled:text-content-disabled',
        caution:
          'bg-danger-solid text-content-inverse hover:bg-danger-solid-hover disabled:bg-muted disabled:text-content-disabled',
        ghost:
          'text-content hover:bg-muted hover:text-content-strong disabled:bg-transparent disabled:text-content-disabled',
        'filter-active':
          'border-2 border-line-stronger bg-surface-card text-content-strong hover:border-line-contrast disabled:border-transparent disabled:bg-muted disabled:text-content-disabled',
      },
      size: {
        small:
          'size-[22px] rounded-medium p-1 before:-inset-3 [&_svg]:size-3.5',
        medium: 'size-8 rounded-large p-2 before:-inset-1.5 [&_svg]:size-4',
        large: 'size-10 rounded-large p-3 before:-inset-0.5 [&_svg]:size-4',
        xlarge: 'size-12 rounded-large p-3 [&_svg]:size-6',
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

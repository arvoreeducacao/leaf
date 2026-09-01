import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/shared/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-large border border-transparent font-medium text-body-small outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-600 disabled:bg-surface-subtle disabled:text-content-disabled',
        destructive:
          'bg-danger-solid text-white hover:bg-danger-solid-hover disabled:bg-surface-subtle disabled:text-content-disabled',
        outline:
          'border-line-strong bg-surface-card text-content-strong hover:bg-surface-hover disabled:bg-transparent disabled:text-content-disabled',
        secondary:
          'border-line-strong bg-surface-card text-content-strong hover:bg-surface-hover disabled:bg-transparent disabled:text-content-disabled',
        ghost:
          'text-content hover:bg-surface-hover hover:text-content-strong disabled:bg-transparent disabled:text-content-disabled',
        link: 'text-link underline-offset-2 hover:underline disabled:bg-transparent disabled:text-content-disabled disabled:no-underline',
      },
      size: {
        default: 'h-10 px-3 tablet:h-8',
        sm: 'h-8 px-2.5 tablet:h-7',
        lg: 'h-11 px-4 tablet:h-9',
        icon: 'size-8 p-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: Readonly<
  React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  )
}

export { Button, buttonVariants }

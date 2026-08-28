import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/shared/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-large border border-transparent font-bold text-[16px] outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-600 disabled:bg-muted disabled:text-gray-400',
        destructive:
          'bg-destructive text-white hover:bg-error-600 disabled:bg-muted disabled:text-gray-400',
        outline:
          'border-gray-600 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:bg-muted disabled:text-gray-400',
        secondary:
          'border-gray-600 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:bg-muted disabled:text-gray-400',
        ghost:
          'text-gray-700 hover:bg-muted hover:text-gray-900 disabled:bg-transparent disabled:text-gray-400',
        link: 'text-primary underline-offset-4 hover:text-primary-600 hover:underline disabled:bg-transparent disabled:text-gray-400 disabled:no-underline',
      },
      size: {
        default: 'h-12 p-3 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-large px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-large p-3 has-[>svg]:px-4',
        icon: 'size-[22px] rounded-medium p-1',
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

import * as React from 'react'

import { cn } from '@/shared/utils'

const Input = React.forwardRef<
  HTMLInputElement,
  Readonly<React.ComponentProps<'input'>>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      className={cn(
        'flex h-10 w-full min-w-0 max-w-125 rounded-large border border-line-muted bg-surface-app px-2 text-body-medium text-content-strong outline-none transition-[color,box-shadow] tablet:h-8 tablet:text-body-small file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-body-small placeholder:text-content-disabled disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/30',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className
      )}
      data-slot="input"
      ref={ref}
      type={type}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export { Input }

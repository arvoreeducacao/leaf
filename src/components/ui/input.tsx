import * as React from 'react'

import { cn } from '@/shared/utils'

const Input = React.forwardRef<
  HTMLInputElement,
  Readonly<React.ComponentProps<'input'>>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      className={cn(
        'flex h-12 w-full min-w-0 max-w-[500px] rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-bold file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
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

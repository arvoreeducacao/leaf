import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/shared/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-medium border-transparent p-4 text-gray-900 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        info: 'bg-gray-200',
        success: 'bg-success-200',
        warning: 'bg-warning-200',
        error: 'bg-error-200',
        default: 'bg-gray-200',
        destructive: 'bg-error-200',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: Readonly<React.ComponentProps<'div'> & VariantProps<typeof alertVariants>>) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role={variant === 'error' || variant === 'destructive' ? 'alert' : 'status'}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn(
        'col-start-2 min-h-4 font-bold text-gray-900 tracking-tight',
        className
      )}
      data-slot="alert-title"
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-gray-900 text-sm [&_p]:leading-medium',
        className
      )}
      data-slot="alert-description"
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }

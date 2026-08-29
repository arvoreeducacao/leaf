'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import type * as React from 'react'

import { CheckIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

function RadioGroup({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof RadioGroupPrimitive.Root>>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn('grid gap-3', className)}
      data-slot="radio-group"
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  variant = 'default',
  ...props
}: Readonly<
  React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
    variant?: 'default' | 'check'
  }
>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'peer aspect-square size-5 shrink-0 rounded-full border border-line-strong outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className="flex items-center justify-center"
        data-slot="radio-group-indicator"
      >
        {variant === 'check' ? (
          <CheckIcon className="size-3.5 text-primary-foreground" />
        ) : (
          <span className="size-2 rounded-full bg-surface-card" />
        )}
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }

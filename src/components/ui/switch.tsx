'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import type * as React from 'react'

import { cn } from '@/shared/utils'

function Switch({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SwitchPrimitive.Root>>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center overflow-visible rounded-medium border transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:border-gray-600 data-[state=unchecked]:bg-transparent',
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none absolute top-1/2 size-5 -translate-y-1/2 rounded-full border border-gray-600 bg-white shadow-down-small transition-[left] duration-200 data-[state=checked]:left-[13px] data-[state=unchecked]:-left-1'
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

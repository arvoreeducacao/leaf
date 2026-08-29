'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import type * as React from 'react'

import { cn } from '@/shared/utils'

function Tabs({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.Root>>) {
  return (
    <TabsPrimitive.Root
      className={cn('flex flex-col gap-2', className)}
      data-slot="tabs"
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.List>>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-[49px] w-full items-center justify-start gap-6 border-line-soft border-b text-content',
        className
      )}
      data-slot="tabs-list"
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.Trigger>>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex h-full items-center justify-center gap-1 whitespace-nowrap border-transparent border-b-2 py-[15px] font-bold text-base text-content transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:text-content-disabled data-[state=active]:border-primary-600 data-[state=active]:text-content-strong data-[state=inactive]:hover:border-line-strong data-[state=inactive]:hover:text-content-strong [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof TabsPrimitive.Content>>) {
  return (
    <TabsPrimitive.Content
      className={cn('flex-1 outline-none', className)}
      data-slot="tabs-content"
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }

'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import type * as React from 'react'

import { CaretDownIcon, CaretUpIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

function Select({
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Root>>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Group>>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Value>>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  children,
  size: _size,
  ...props
}: Readonly<
  React.ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: 'sm' | 'default'
  }
>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-12 w-full items-center justify-between gap-2 whitespace-nowrap rounded-large border border-gray-600 bg-white px-4 py-2 text-[16px] text-gray-900 outline-none transition-colors hover:border-gray-900 focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-muted disabled:text-gray-400 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[state=open]:border-gray-900 data-[placeholder]:text-gray-500 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-gray-500 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDownIcon className="size-4 text-gray-500 transition-transform data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Content>>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-large border border-gray-300 bg-white text-gray-700 shadow-down-medium data-[state=closed]:animate-out data-[state=open]:animate-in',
          position === 'popper' &&
            'data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className
        )}
        data-slot="select-content"
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-0',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Label>>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-4 py-2 font-bold text-gray-500 text-xs', className)}
      data-slot="select-label"
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Item>>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex h-12 w-full cursor-pointer select-none items-center gap-2 border-gray-100 border-b px-4 py-2 pr-8 text-[16px] text-gray-700 outline-hidden last:border-b-0 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 data-[state=checked]:font-bold data-[state=checked]:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-gray-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      data-slot="select-item"
      {...props}
    >
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-primary-700" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.Separator>>) {
  return (
    <SelectPrimitive.Separator
      className={cn('pointer-events-none my-0 h-px bg-gray-200', className)}
      data-slot="select-separator"
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        className
      )}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <CaretUpIcon className="size-4 text-gray-500" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        className
      )}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <CaretDownIcon className="size-4 text-gray-500" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

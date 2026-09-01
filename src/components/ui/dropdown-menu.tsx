'use client'

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type * as React from 'react'

import { CaretRightIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

function DropdownMenu({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Root>>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Portal>>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Content>>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[12rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-lg bg-surface-card p-1 text-content shadow-down-medium data-[state=closed]:animate-out data-[state=open]:animate-in',
          className
        )}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Group>>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }
>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "data-[variant=destructive]:*:[svg]:!text-danger relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium px-2 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-danger data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-danger-surface [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-content-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium py-0 pr-2 pl-7 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-content-strong" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium py-0 pr-2 pl-7 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <span className="block size-2 rounded-full bg-content-strong" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-2 py-1 font-medium text-caption text-content-subtle data-[inset]:pl-8',
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Separator>>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-line', className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: Readonly<React.ComponentProps<'span'>>) {
  return (
    <span
      className={cn('ml-auto text-caption text-content-disabled', className)}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.Sub>>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Readonly<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium px-2 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[state=open]:bg-surface-hover data-[inset]:pl-8',
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto size-4 text-content-subtle" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[12rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-surface-card p-1 text-content shadow-down-medium data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      data-slot="dropdown-menu-sub-content"
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}

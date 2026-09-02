'use client'

import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import type * as React from 'react'

import { CaretRightIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

function ContextMenu({
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Root>>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Trigger>>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuGroup({
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Group>>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Content>>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[12rem] origin-(--radix-context-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-lg bg-surface-card p-1 text-content shadow-down-medium data-[state=closed]:animate-out data-[state=open]:animate-in',
          className
        )}
        data-slot="context-menu-content"
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: Readonly<
  React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }
>) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "data-[variant=destructive]:*:[svg]:!text-danger relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium px-2 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-danger data-[disabled]:opacity-50 data-[variant=destructive]:focus:bg-danger-surface [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-content-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium py-0 pr-2 pl-7 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-content-strong" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: Readonly<
  React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        'px-2 py-1 font-medium text-caption text-content-subtle data-[inset]:pl-8',
        className
      )}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Separator>>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-line', className)}
      data-slot="context-menu-separator"
      {...props}
    />
  )
}

function ContextMenuSub({
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.Sub>>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Readonly<
  React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-medium px-2 text-body-small text-content-strong outline-hidden transition-colors tablet:h-7 hover:bg-surface-hover focus:bg-surface-hover data-[state=open]:bg-surface-hover data-[inset]:pl-8',
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto size-4 text-content-subtle" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof ContextMenuPrimitive.SubContent>>) {
  return (
    <ContextMenuPrimitive.SubContent
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[12rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-lg bg-surface-card p-1 text-content shadow-down-medium data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      data-slot="context-menu-sub-content"
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
}

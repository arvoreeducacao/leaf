'use client'

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import type * as React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/shared/utils'

function AlertDialog({
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Root>>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Trigger>>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Portal>>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Overlay>>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-alpha-800 data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Content>>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xlarge border bg-white p-6 shadow-center-xlarge duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-lg',
          className
        )}
        data-slot="alert-dialog-content"
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn('flex flex-col gap-2 text-left', className)}
      data-slot="alert-dialog-header"
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Title>>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('font-bold text-heading-medium text-gray-900', className)}
      data-slot="alert-dialog-title"
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Description>>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-body-small text-gray-700', className)}
      data-slot="alert-dialog-description"
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Action>>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      data-slot="alert-dialog-action"
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AlertDialogPrimitive.Cancel>>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      data-slot="alert-dialog-cancel"
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}

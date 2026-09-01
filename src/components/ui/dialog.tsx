'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { CancelIcon } from '@/components/icons'
import type * as React from 'react'

import { cn } from '@/shared/utils'

function Dialog({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Root>>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Trigger>>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Portal>>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Close>>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Overlay>>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Readonly<
  React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
  }
>) {
  const t = useTranslations('common')

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 grid max-h-[85dvh] w-full gap-4 overflow-y-auto rounded-t-xlarge rounded-b-none bg-surface-card p-5 pb-[max(calc(var(--spacing)*5),env(safe-area-inset-bottom))] shadow-center-xlarge duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in',
          'tablet:data-[state=closed]:zoom-out-95 tablet:data-[state=open]:zoom-in-95 tablet:data-[state=closed]:slide-out-to-bottom-0 tablet:data-[state=open]:slide-in-from-bottom-0 tablet:inset-x-auto tablet:top-[50%] tablet:bottom-auto tablet:left-[50%] tablet:w-[calc(100%-2rem)] tablet:max-w-lg tablet:translate-x-[-50%] tablet:translate-y-[-50%] tablet:rounded-b-xlarge tablet:pb-5',
          className
        )}
        data-slot="dialog-content"
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-2 h-1 w-10 shrink-0 rounded-pill bg-surface-grabber tablet:hidden"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-large text-content-subtle transition-colors tablet:size-7 hover:bg-surface-hover hover:text-content-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            data-slot="dialog-close"
          >
            <CancelIcon />
            <span className="sr-only">{t('close')}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn('flex flex-col gap-2 text-left', className)}
      data-slot="dialog-header"
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 tablet:flex-row tablet:justify-end',
        className
      )}
      data-slot="dialog-footer"
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Title>>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-semibold text-content-strong text-heading-medium', className)}
      data-slot="dialog-title"
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DialogPrimitive.Description>>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body-small text-content', className)}
      data-slot="dialog-description"
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

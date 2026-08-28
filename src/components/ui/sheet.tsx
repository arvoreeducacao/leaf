'use client'

import * as SheetPrimitive from '@radix-ui/react-dialog'
import type * as React from 'react'

import { CancelIcon } from '@/components/icons'
import { StepProgress } from '@/components/ui/step-progress'
import { cn } from '@/shared/utils'

function Sheet({
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Root>>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Trigger>>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Close>>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Portal>>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Overlay>>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-alpha-800 data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showClose = true,
  ...props
}: Readonly<
  React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: 'top' | 'right' | 'bottom' | 'left'
    showClose?: boolean
  }
>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 bg-white shadow-down-xlarge transition ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-gray-200 border-l sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-gray-200 border-r sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto rounded-b-xlarge border-gray-200 border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto rounded-t-xlarge shadow-up-medium',
          className
        )}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showClose && (
          <SheetPrimitive.Close
            aria-label="Fechar"
            className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-large text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none"
          >
            <CancelIcon className="size-5" />
            <span className="sr-only">Fechar</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({
  className,
  type = 'standard',
  subtitle,
  title,
  steps,
  currentStep = 0,
  children,
  ...props
}: Readonly<
  Omit<React.ComponentProps<'div'>, 'title'> & {
    type?: 'standard' | 'close' | 'progress' | 'draggable'
    title?: React.ReactNode
    subtitle?: React.ReactNode
    steps?: number
    currentStep?: number
  }
>) {
  const hasStructured = title != null || type !== 'standard' || subtitle != null

  if (!hasStructured) {
    return (
      <div
        className={cn('flex flex-col gap-1.5 p-5', className)}
        data-slot="sheet-header"
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col gap-4 pt-2 pb-0', className)}
      data-slot="sheet-header"
      {...props}
    >
      {type === 'draggable' && (
        <span className="mx-auto h-1 w-12 shrink-0 rounded-pill bg-gray-200" />
      )}
      <div className="flex items-center justify-between gap-2 px-4">
        {type === 'close' && <span aria-hidden className="size-12 shrink-0" />}
        {type === 'progress' ? (
          <div className="flex flex-1 justify-center">
            <StepProgress current={currentStep} total={steps ?? 5} />
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-1 flex-col gap-1',
              type === 'standard' || type === 'draggable' || type === 'close'
                ? 'items-center text-center'
                : 'items-start'
            )}
          >
            {title != null && <SheetTitle>{title}</SheetTitle>}
            {subtitle != null && (
              <SheetDescription>{subtitle}</SheetDescription>
            )}
          </div>
        )}
        {type === 'close' && (
          <SheetClose
            aria-label="Fechar"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-large text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <CancelIcon className="size-6" />
            <span className="sr-only">Fechar</span>
          </SheetClose>
        )}
      </div>
      <div className="h-px w-full bg-gray-200" />
      {children}
    </div>
  )
}

function SheetFooter({
  className,
  ...props
}: Readonly<React.ComponentProps<'div'>>) {
  return (
    <div
      className={cn('mt-auto flex flex-col gap-2 p-5', className)}
      data-slot="sheet-footer"
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Title>>) {
  return (
    <SheetPrimitive.Title
      className={cn('font-bold text-[20px] text-gray-900', className)}
      data-slot="sheet-title"
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof SheetPrimitive.Description>>) {
  return (
    <SheetPrimitive.Description
      className={cn('text-[16px] text-gray-600', className)}
      data-slot="sheet-description"
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}

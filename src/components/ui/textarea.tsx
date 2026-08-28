'use client'

import * as React from 'react'

import { cn } from '@/shared/utils'

type TextareaProps = Omit<
  React.ComponentProps<'textarea'>,
  'value' | 'onChange'
> & {
  label?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  error?: boolean
  helperText?: string
  resizable?: boolean
}

function PlainTextarea({
  className,
  resizable,
  error,
  ...props
}: Readonly<Omit<TextareaProps, 'label' | 'helperText'>>) {
  return (
    <textarea
      aria-invalid={error}
      className={cn(
        'flex min-h-16 w-full min-w-[180px] max-w-[500px] rounded-large border bg-transparent px-3 py-2 text-base text-gray-700 outline-none transition-colors placeholder:text-gray-600 focus-visible:border-2 focus-visible:border-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100',
        error ? 'border-destructive' : 'border-gray-700',
        resizable ? 'resize-y' : 'resize-none',
        className
      )}
      data-slot="textarea"
      {...props}
    />
  )
}

function Textarea({
  id,
  label,
  value,
  onChange,
  error,
  helperText,
  resizable = false,
  disabled,
  className,
  ...props
}: Readonly<TextareaProps>) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [internal, setInternal] = React.useState('')

  if (!label) {
    return (
      <PlainTextarea
        className={className}
        disabled={disabled}
        error={error}
        id={id}
        onChange={onChange}
        resizable={resizable}
        value={value}
        {...props}
      />
    )
  }

  const current = value ?? internal
  const isFloating = isFocused || (current?.length ?? 0) > 0
  const fieldId = id ?? `textarea-${label}`
  const helperId = helperText ? `${fieldId}-helper` : undefined

  return (
    <div className={cn('w-full min-w-[180px]', className)}>
      <fieldset
        className={cn(
          'relative m-0 min-w-0 rounded-large border px-0 pt-1 transition-colors',
          isFocused && 'border-2',
          error ? 'border-destructive' : 'border-gray-700',
          disabled && 'cursor-not-allowed bg-gray-100'
        )}
      >
        <legend
          className={cn(
            'pointer-events-none ml-3 h-0 overflow-hidden whitespace-nowrap p-0 text-sm transition-all duration-150',
            isFloating ? 'max-w-full px-1' : 'max-w-0 px-0'
          )}
        >
          <span
            aria-hidden="true"
            className="inline-block"
            style={{ width: `${label.length}ch` }}
          />
        </legend>
        <textarea
          aria-describedby={helperId}
          aria-invalid={error}
          className={cn(
            'min-h-20 w-full bg-transparent px-4 pb-2 text-base text-gray-700 outline-none placeholder-transparent',
            resizable ? 'resize-y' : 'resize-none',
            disabled && 'cursor-not-allowed'
          )}
          disabled={disabled}
          id={fieldId}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => {
            setInternal(e.target.value)
            onChange?.(e)
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={label}
          value={current}
          {...props}
        />
        <label
          className={cn(
            'pointer-events-none absolute left-4 origin-left transition-all duration-150',
            error ? 'text-destructive' : 'text-gray-700',
            isFloating
              ? '-translate-y-1/2 top-0 left-3 px-1 text-sm'
              : 'top-3 text-base'
          )}
          htmlFor={fieldId}
        >
          {label}
        </label>
      </fieldset>
      {helperText && (
        <p
          className={cn(
            'mt-1 px-1 text-sm',
            error ? 'text-destructive' : 'text-gray-600'
          )}
          id={helperId}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}

export type { TextareaProps }
export { Textarea }

'use client'

import { useTranslations } from 'next-intl'
import { useId, useRef, useState } from 'react'

import { optionChipClass } from '@/components/database/option-colors'
import { CancelIcon, PaperclipIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MAX_ATTACHMENTS, type ResolvedQuestion } from '@/lib/database/forms'
import type { PropertyValue } from '@/lib/database/values'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  question: ResolvedQuestion
  value: PropertyValue
  invalid: boolean
  disabled: boolean
  uploadPath: string
  onChange: (value: PropertyValue) => void
}>

function chipClass(active: boolean, color: string) {
  return cn(
    'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-large border px-3 text-body-small transition-colors',
    active
      ? color
      : 'border-line-muted bg-surface-app text-content hover:bg-surface-hover',
  )
}

function Attachments({ value, disabled, uploadPath, onChange }: Props) {
  const t = useTranslations('form')
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [failure, setFailure] = useState('')
  const links = Array.isArray(value) ? [...value] : []

  async function send(files: FileList) {
    setFailure('')
    setUploading(true)

    const next = [...links]

    for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS)) {
      if (next.length >= MAX_ATTACHMENTS) {
        break
      }

      const body = new FormData()

      body.append('file', file)

      try {
        const response = await fetch(uploadPath, { body, method: 'POST' })
        const payload = (await response.json()) as {
          url?: string
          error?: string
        }

        if (!response.ok || !payload.url) {
          setFailure(payload.error ?? t('uploadFailed'))
          continue
        }

        next.push(payload.url)
      } catch {
        setFailure(t('uploadFailed'))
      }
    }

    setUploading(false)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        className="sr-only"
        disabled={disabled || uploading}
        multiple
        onChange={(event) => {
          const files = event.target.files

          if (files && files.length > 0) {
            void send(files)
          }

          event.target.value = ''
        }}
        ref={input}
        type="file"
      />

      <Button
        className="self-start"
        disabled={disabled || uploading || links.length >= MAX_ATTACHMENTS}
        onClick={() => input.current?.click()}
        type="button"
        variant="secondary"
      >
        <PaperclipIcon aria-hidden="true" className="size-4" />
        {uploading ? t('uploading') : t('addAttachment')}
      </Button>

      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li
              className="flex items-center gap-1 rounded-large border border-line-muted bg-surface-card p-1"
              key={link}
            >
              <img
                alt=""
                className="size-14 rounded-medium object-cover"
                src={link}
              />
              <ButtonIcon
                aria-label={t('removeAttachment')}
                disabled={disabled}
                onClick={() =>
                  onChange(links.filter((item) => item !== link))
                }
                size="small"
                type="button"
                variant="ghost"
              >
                <CancelIcon aria-hidden="true" className="size-4" />
              </ButtonIcon>
            </li>
          ))}
        </ul>
      ) : null}

      {failure.length > 0 ? (
        <p className="text-body-small text-destructive" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  )
}

export function FormField(props: Props) {
  const { question, value, invalid, disabled, onChange } = props
  const t = useTranslations('form')
  const fieldId = useId()
  const descriptionId = `${fieldId}-description`
  const describedBy =
    question.description.length > 0 ? descriptionId : undefined

  const label = (
    <span className="font-medium text-body-medium text-content-strong">
      {question.name}
      {question.required ? (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      ) : null}
      {question.required ? (
        <span className="sr-only">{t('requiredHint')}</span>
      ) : null}
    </span>
  )

  const description =
    question.description.length > 0 ? (
      <p className="text-body-small text-content" id={descriptionId}>
        {question.description}
      </p>
    ) : null

  if (question.attachment) {
    return (
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 flex flex-col gap-1">
          {label}
          {description}
        </legend>
        <Attachments {...props} />
      </fieldset>
    )
  }

  if (question.type === 'multiSelect' || question.type === 'select' || question.type === 'status') {
    const multiple = question.type === 'multiSelect'
    const selected = Array.isArray(value)
      ? value
      : typeof value === 'string' && value.length > 0
        ? [value]
        : []

    return (
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 flex flex-col gap-1">
          {label}
          {description}
        </legend>
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => {
            const active = selected.includes(option.id)

            return (
              <label
                className={chipClass(active, optionChipClass[option.color])}
                key={option.id}
              >
                <input
                  aria-describedby={describedBy}
                  checked={active}
                  className="sr-only"
                  disabled={disabled}
                  name={fieldId}
                  onChange={() => {
                    if (!multiple) {
                      onChange(active ? null : option.id)

                      return
                    }

                    onChange(
                      active
                        ? selected.filter((item) => item !== option.id)
                        : [...selected, option.id],
                    )
                  }}
                  type={multiple ? 'checkbox' : 'radio'}
                />
                {option.name}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  if (question.type === 'checkbox') {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2">
          <input
            aria-describedby={describedBy}
            checked={value === true}
            className="mt-1 size-4 accent-primary"
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          {label}
        </label>
        {description}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1" htmlFor={fieldId}>
        {label}
        {description}
      </label>

      {question.long ? (
        <Textarea
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="max-w-none"
          disabled={disabled}
          id={fieldId}
          onChange={(event) => onChange(event.target.value)}
          resizable
          value={typeof value === 'string' ? value : ''}
        />
      ) : (
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="max-w-none"
          disabled={disabled}
          id={fieldId}
          inputMode={question.type === 'number' ? 'decimal' : undefined}
          onChange={(event) =>
            onChange(
              question.type === 'number' && event.target.value.length === 0
                ? null
                : event.target.value,
            )
          }
          type={
            question.type === 'date'
              ? 'date'
              : question.type === 'number'
                ? 'number'
                : question.type === 'url'
                  ? 'url'
                  : 'text'
          }
          value={
            value === null || value === undefined || Array.isArray(value)
              ? ''
              : String(value)
          }
        />
      )}

      {invalid ? (
        <p className="text-body-small text-destructive" role="alert">
          {t('requiredField')}
        </p>
      ) : null}
    </div>
  )
}

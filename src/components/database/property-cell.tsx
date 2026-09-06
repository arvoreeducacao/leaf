'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { uploadEditorFile } from '@/components/editor/upload-file'
import {
  AddIcon,
  CancelIcon,
  CheckIcon,
  PaperclipIcon,
} from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, personOptions } from '@/lib/database/people'
import {
  formatUniqueId,
  parseUniqueIdConfig,
} from '@/lib/database/unique-id'
import {
  type PropertyValue,
  type SelectOption,
  fileNameOf,
  formatNumber,
  isImageFileUrl,
  linkHrefFor,
  normalizeValue,
  parseOptions,
} from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { SelectEditor } from './select-editor'

type Props = Readonly<{
  property: DatabaseProperty
  value: PropertyValue
  rowTitle: string
  readOnly: boolean
  compact?: boolean
  wrap?: boolean
  people?: ReadonlyArray<Person>
  onCommit: (value: PropertyValue) => void
  onCreateOption: (name: string) => Promise<SelectOption | null>
}>

function textFor(
  property: DatabaseProperty,
  value: PropertyValue,
  locale: string,
): string {
  if (property.type === 'number') {
    return typeof value === 'number' ? formatNumber(value, locale) : ''
  }

  return typeof value === 'string' ? value : ''
}

export function PropertyCell({
  property,
  value,
  rowTitle,
  readOnly,
  compact = false,
  wrap = false,
  people = [],
  onCommit,
  onCreateOption,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const label = t('cellLabel', { property: property.name, row: rowTitle })
  const options =
    property.type === 'person'
      ? personOptions(people)
      : parseOptions(property.options)

  const compactFrame = wrap
    ? 'min-h-9 px-2 py-1.5 tablet:min-h-8'
    : 'h-9 px-2 tablet:h-8'

  const inputClass = cn(
    'w-full min-w-0 rounded-medium bg-transparent text-body-small text-content-strong outline-none transition-colors placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2 disabled:text-content',
    compact ? compactFrame : 'min-h-9 border border-line px-2 py-1',
  )

  if (
    property.type === 'select' ||
    property.type === 'multiSelect' ||
    property.type === 'person' ||
    property.type === 'status'
  ) {
    const multiple =
      property.type === 'multiSelect' || property.type === 'person'
    const selected = multiple
      ? Array.isArray(value)
        ? [...value]
        : []
      : typeof value === 'string' && value.length > 0
        ? [value]
        : []

    return (
      <SelectEditor
        compact={compact}
        creatable={property.type !== 'person'}
        wrap={wrap}
        emptyHint={property.type === 'person' ? t('noPeople') : undefined}
        label={label}
        multiple={multiple}
        onChange={(next) => onCommit(multiple ? next : (next[0] ?? null))}
        onCreate={onCreateOption}
        options={options}
        readOnly={readOnly}
        selected={selected}
        variant={
          property.type === 'person'
            ? 'person'
            : property.type === 'status'
              ? 'status'
              : 'option'
        }
      />
    )
  }

  if (property.type === 'uniqueId') {
    const text = formatUniqueId(value, parseUniqueIdConfig(property.options).prefix)

    return (
      <span
        aria-label={label}
        className={cn(
          'flex min-w-0 items-center text-body-small text-content tabular-nums',
          compact ? compactFrame : 'min-h-9 px-2 py-1',
        )}
      >
        <span className="truncate">{text}</span>
      </span>
    )
  }

  if (property.type === 'files') {
    return (
      <FilesCell
        compact={compact}
        frame={compactFrame}
        label={label}
        onCommit={onCommit}
        readOnly={readOnly}
        value={value}
      />
    )
  }

  if (property.type === 'checkbox') {
    const checked = value === true

    return (
      <span
        className={cn(
          'flex items-center',
          compact ? compactFrame : 'min-h-9 px-2 py-1',
        )}
      >
        <button
          aria-checked={checked}
          aria-label={label}
          className={cn(
            'flex size-4 cursor-pointer items-center justify-center rounded-small border transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 disabled:cursor-not-allowed',
            checked
              ? 'border-brand bg-brand text-white'
              : 'border-line-strong hover:bg-surface-hover',
          )}
          disabled={readOnly}
          onClick={() => onCommit(!checked)}
          role="checkbox"
          type="button"
        >
          {checked ? (
            <CheckIcon aria-hidden="true" className="size-3" />
          ) : null}
        </button>
      </span>
    )
  }

  if (property.type === 'date') {
    return (
      <input
        aria-label={label}
        className={inputClass}
        disabled={readOnly}
        onChange={(event) => onCommit(event.target.value || null)}
        type="date"
        value={typeof value === 'string' ? value : ''}
      />
    )
  }

  return (
    <TextualCell
      className={inputClass}
      label={label}
      locale={locale}
      onCommit={onCommit}
      property={property}
      readOnly={readOnly}
      value={value}
      wrap={wrap && property.type !== 'number'}
    />
  )
}

function TextualCell({
  property,
  value,
  label,
  locale,
  readOnly,
  className,
  wrap,
  onCommit,
}: Readonly<{
  property: DatabaseProperty
  value: PropertyValue
  label: string
  locale: string
  readOnly: boolean
  className: string
  wrap: boolean
  onCommit: (value: PropertyValue) => void
}>) {
  const [draft, setDraft] = useState(() => textFor(property, value, locale))
  const external = useRef(value)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = area.current

    if (!element) {
      return
    }

    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [draft])

  useEffect(() => {
    if (external.current === value) {
      return
    }

    external.current = value
    setDraft(textFor(property, value, locale))
  }, [locale, property, value])

  function commit() {
    const next = normalizeValue(property.type, draft)

    external.current = next
    setDraft(textFor(property, next, locale))

    if (next !== value) {
      onCommit(next)
    }
  }

  if (readOnly && property.type === 'url' && draft.length > 0) {
    const safe = linkHrefFor(draft)

    if (safe === null) {
      return (
        <span
          aria-label={label}
          className={cn(className, 'block', wrap ? 'break-words' : 'truncate')}
        >
          {draft}
        </span>
      )
    }

    return (
      <a
        className={cn(
          className,
          'block text-link underline',
          wrap ? 'break-words' : 'truncate',
        )}
        href={safe}
        rel="noreferrer noopener"
        target="_blank"
      >
        {safe}
      </a>
    )
  }

  if (wrap) {
    return (
      <textarea
        aria-label={label}
        className={cn(className, 'resize-none overflow-hidden break-words')}
        disabled={readOnly}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }

          if (event.key === 'Escape') {
            setDraft(textFor(property, value, locale))
            event.currentTarget.blur()
          }
        }}
        ref={area}
        rows={1}
        value={draft}
      />
    )
  }

  return (
    <input
      aria-label={label}
      className={cn(className, property.type === 'number' && 'text-right')}
      disabled={readOnly}
      inputMode={property.type === 'number' ? 'decimal' : undefined}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }

        if (event.key === 'Escape') {
          setDraft(textFor(property, value, locale))
          event.currentTarget.blur()
        }
      }}
      type={property.type === 'url' ? 'url' : 'text'}
      value={draft}
    />
  )
}

function FilesCell({
  value,
  label,
  readOnly,
  compact,
  frame,
  onCommit,
}: Readonly<{
  value: PropertyValue
  label: string
  readOnly: boolean
  compact: boolean
  frame: string
  onCommit: (value: PropertyValue) => void
}>) {
  const t = useTranslations('database')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const urls = Array.isArray(value) ? [...value] : []

  async function add(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    setBusy(true)

    try {
      const uploaded: Array<string> = []

      for (const file of Array.from(files)) {
        uploaded.push(await uploadEditorFile(file, t('fileUploadFailed')))
      }

      onCommit([...urls, ...uploaded])
    } catch {
      return
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1',
        compact ? frame : 'min-h-9 px-2 py-1',
      )}
    >
      {urls.map((url) => {
        const name = fileNameOf(url)
        const picture = isImageFileUrl(url)

        return (
          <span className="group/file relative flex max-w-40" key={url}>
            <a
              aria-label={t('openFile', { name })}
              className={cn(
                'flex min-w-0 items-center gap-1 rounded-medium',
                picture
                  ? ''
                  : 'bg-surface-subtle px-1.5 py-0.5 text-body-small text-content',
              )}
              href={url}
              rel="noreferrer noopener"
              target="_blank"
              title={name}
            >
              {picture ? (
                <img
                  alt={name}
                  className="size-6 rounded-small border border-line-muted object-cover"
                  src={url}
                />
              ) : (
                <>
                  <PaperclipIcon aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{name}</span>
                </>
              )}
            </a>
            {readOnly ? null : (
              <button
                aria-label={t('removeFile', { name })}
                className="absolute -right-1 -top-1 hidden size-4 cursor-pointer items-center justify-center rounded-full bg-surface-app text-content-subtle shadow-small hover:text-content-strong focus-visible:flex group-hover/file:flex"
                onClick={() => onCommit(urls.filter((item) => item !== url))}
                type="button"
              >
                <CancelIcon aria-hidden="true" className="size-2.5" />
              </button>
            )}
          </span>
        )
      })}
      {readOnly ? null : (
        <>
          <input
            className="hidden"
            multiple
            onChange={(event) => {
              void add(event.target.files)
              event.target.value = ''
            }}
            ref={input}
            type="file"
          />
          <button
            aria-label={t('addFile')}
            className="flex size-5 cursor-pointer items-center justify-center rounded-small text-content-subtle transition-colors hover:bg-surface-hover hover:text-content-strong disabled:cursor-not-allowed"
            disabled={busy}
            onClick={() => input.current?.click()}
            type="button"
          >
            <AddIcon aria-hidden="true" className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

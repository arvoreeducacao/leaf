'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { CheckboxActiveIcon, CheckboxIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import { type Person, personOptions } from '@/lib/database/people'
import {
  formatUniqueId,
  parseUniqueIdConfig,
} from '@/lib/database/unique-id'
import {
  type PropertyValue,
  type SelectOption,
  formatNumber,
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

  if (property.type === 'checkbox') {
    const checked = value === true

    return (
      <span
        className={cn(
          'flex items-center',
          compact ? compactFrame : 'min-h-9',
        )}
      >
        <button
          aria-checked={checked}
          aria-label={label}
          className="flex size-6 cursor-pointer items-center justify-center rounded-medium text-content-strong transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:text-content-disabled"
          disabled={readOnly}
          onClick={() => onCommit(!checked)}
          role="checkbox"
          type="button"
        >
          {checked ? (
            <CheckboxActiveIcon aria-hidden="true" className="size-5" />
          ) : (
            <CheckboxIcon aria-hidden="true" className="size-5" />
          )}
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

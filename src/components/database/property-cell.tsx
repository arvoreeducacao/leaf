'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { CheckboxActiveIcon, CheckboxIcon } from '@/components/icons'
import type { DatabaseProperty } from '@/db/schema'
import {
  type PropertyValue,
  type SelectOption,
  formatNumber,
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
  onCommit,
  onCreateOption,
}: Props) {
  const t = useTranslations('database')
  const locale = useLocale()
  const label = t('cellLabel', { property: property.name, row: rowTitle })
  const options = parseOptions(property.options)

  const inputClass = cn(
    'w-full min-w-0 rounded-medium bg-transparent text-body-small text-content-strong outline-none transition-colors placeholder:text-content-subtle focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2 disabled:text-content',
    compact ? 'h-9 px-2 tablet:h-8' : 'min-h-9 border border-line px-2 py-1',
  )

  if (property.type === 'select' || property.type === 'multiSelect') {
    const selected =
      property.type === 'multiSelect'
        ? Array.isArray(value)
          ? [...value]
          : []
        : typeof value === 'string' && value.length > 0
          ? [value]
          : []

    return (
      <SelectEditor
        compact={compact}
        label={label}
        multiple={property.type === 'multiSelect'}
        onChange={(next) =>
          onCommit(property.type === 'multiSelect' ? next : (next[0] ?? null))
        }
        onCreate={onCreateOption}
        options={options}
        readOnly={readOnly}
        selected={selected}
      />
    )
  }

  if (property.type === 'checkbox') {
    const checked = value === true

    return (
      <span
        className={cn('flex items-center', compact ? 'h-9 px-2 tablet:h-8' : 'min-h-9')}
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
  onCommit,
}: Readonly<{
  property: DatabaseProperty
  value: PropertyValue
  label: string
  locale: string
  readOnly: boolean
  className: string
  onCommit: (value: PropertyValue) => void
}>) {
  const [draft, setDraft] = useState(() => textFor(property, value, locale))
  const external = useRef(value)

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
    return (
      <a
        className={cn(className, 'block truncate text-link underline')}
        href={draft}
        rel="noreferrer noopener"
        target="_blank"
      >
        {draft}
      </a>
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

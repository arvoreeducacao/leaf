'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { AddIcon, CancelIcon, CheckIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { SelectOption } from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { optionChipClass } from './option-colors'

export function OptionChip({
  option,
  onRemove,
  removeLabel,
}: Readonly<{
  option: SelectOption
  onRemove?: () => void
  removeLabel?: string
}>) {
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-pill border px-2 font-bold text-caption leading-none',
        optionChipClass[option.color],
      )}
    >
      <span className="truncate">{option.name}</span>
      {onRemove ? (
        <button
          aria-label={removeLabel}
          className="-mr-1 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-circular transition-colors hover:bg-alpha-200 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          type="button"
        >
          <CancelIcon aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

type Props = Readonly<{
  label: string
  options: ReadonlyArray<SelectOption>
  selected: ReadonlyArray<string>
  multiple: boolean
  readOnly: boolean
  compact?: boolean
  onChange: (next: Array<string>) => void
  onCreate: (name: string) => Promise<SelectOption | null>
}>

export function SelectEditor({
  label,
  options,
  selected,
  multiple,
  readOnly,
  compact = false,
  onChange,
  onCreate,
}: Props) {
  const t = useTranslations('database')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const chosen = useMemo(
    () =>
      selected
        .map((id) => options.find((option) => option.id === id))
        .filter((option): option is SelectOption => option !== undefined),
    [options, selected],
  )

  const trimmed = query.trim()

  const filtered = useMemo(() => {
    if (trimmed.length === 0) {
      return options
    }

    const needle = trimmed.toLowerCase()

    return options.filter((option) =>
      option.name.toLowerCase().includes(needle),
    )
  }, [options, trimmed])

  const exact = options.some(
    (option) => option.name.toLowerCase() === trimmed.toLowerCase(),
  )

  function toggle(id: string) {
    if (multiple) {
      onChange(
        selected.includes(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id],
      )

      return
    }

    onChange(selected.includes(id) ? [] : [id])
    setOpen(false)
  }

  async function create() {
    if (trimmed.length === 0 || creating) {
      return
    }

    setCreating(true)
    const option = await onCreate(trimmed)
    setCreating(false)

    if (!option) {
      return
    }

    setQuery('')
    toggle(option.id)
  }

  const summary = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {chosen.length > 0 ? (
        chosen.map((option) => <OptionChip key={option.id} option={option} />)
      ) : (
        <span className="truncate text-content-subtle">
          {readOnly ? '' : t('selectPlaceholder')}
        </span>
      )}
    </span>
  )

  if (readOnly) {
    return (
      <span className={cn('flex min-w-0 items-center', compact && 'h-9 px-2')}>
        {summary}
      </span>
    )
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            'flex w-full min-w-0 cursor-pointer items-center rounded-medium text-left text-body-small transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
            compact ? 'h-9 px-2' : 'min-h-9 border border-line px-2 py-1',
          )}
          type="button"
        >
          {summary}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          aria-label={t('searchOrCreate')}
          className="h-9 text-body-small"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !exact && trimmed.length > 0) {
              event.preventDefault()
              void create()
            }
          }}
          placeholder={t('searchOrCreate')}
          value={query}
        />
        <ul className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {filtered.map((option) => {
            const active = selected.includes(option.id)

            return (
              <li key={option.id}>
                <button
                  aria-pressed={active}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                  onClick={() => toggle(option.id)}
                  type="button"
                >
                  <OptionChip option={option} />
                  <span className="flex-1" />
                  {active ? (
                    <CheckIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-content-strong"
                    />
                  ) : null}
                </button>
              </li>
            )
          })}
          {trimmed.length > 0 && !exact ? (
            <li>
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-medium px-2 py-1.5 text-left text-body-small text-content transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
                disabled={creating}
                onClick={() => void create()}
                type="button"
              >
                <AddIcon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">
                  {t('createOption', { name: trimmed })}
                </span>
              </button>
            </li>
          ) : null}
        </ul>
        {chosen.length > 0 ? (
          <button
            className="mt-2 w-full cursor-pointer rounded-medium px-2 py-1.5 text-left text-body-small text-content transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
            onClick={() => onChange([])}
            type="button"
          >
            {t('clearValue')}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

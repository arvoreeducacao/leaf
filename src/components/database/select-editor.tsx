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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  type SelectOption,
  groupOf,
  sortByStatusGroup,
  statusGroups,
} from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { optionChipClass, optionDotClass } from './option-colors'

export type EditorVariant = 'option' | 'person' | 'status'

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export function PersonChip({
  option,
  onRemove,
  removeLabel,
}: Readonly<{
  option: SelectOption
  onRemove?: () => void
  removeLabel?: string
}>) {
  return (
    <span className="inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 rounded-pill bg-surface-hover pr-2 pl-0.5 text-caption leading-none">
      <Avatar className="size-5">
        <AvatarFallback
          className={cn('text-[9px] font-bold', optionChipClass[option.color])}
        >
          {initialsOf(option.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-content-strong">{option.name}</span>
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

export function StatusChip({
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
        'inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 rounded-medium px-1.5 font-regular text-body-small leading-5',
        optionChipClass[option.color],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 shrink-0 rounded-circular',
          optionDotClass[option.color],
        )}
      />
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
        'inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-medium px-1.5 font-regular text-body-small leading-5',
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
  wrap?: boolean
  variant?: EditorVariant
  creatable?: boolean
  emptyHint?: string
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
  wrap = false,
  variant = 'option',
  creatable = true,
  emptyHint,
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

  const Chip =
    variant === 'person'
      ? PersonChip
      : variant === 'status'
        ? StatusChip
        : OptionChip
  const canCreate = creatable && trimmed.length > 0 && !exact

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

  const compactFrame = wrap
    ? 'min-h-9 px-2 py-1.5 tablet:min-h-8'
    : 'h-9 px-2 tablet:h-8'

  const summary = (
    <span
      className={cn(
        'flex min-w-0 flex-1 items-center gap-1',
        compact && !wrap ? 'overflow-hidden' : 'flex-wrap',
      )}
    >
      {chosen.length > 0 ? (
        chosen.map((option) => <Chip key={option.id} option={option} />)
      ) : (
        <span className="truncate text-content-subtle">
          {readOnly ? '' : t('selectPlaceholder')}
        </span>
      )}
    </span>
  )

  if (readOnly) {
    return (
      <span
        className={cn('flex min-w-0 items-center', compact && compactFrame)}
      >
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
            compact ? compactFrame : 'min-h-9 border border-line px-2 py-1',
          )}
          type="button"
        >
          {summary}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          aria-label={creatable ? t('searchOrCreate') : t('searchPeople')}
          className="h-9 text-body-small tablet:h-8"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canCreate) {
              event.preventDefault()
              void create()
            }
          }}
          placeholder={creatable ? t('searchOrCreate') : t('searchPeople')}
          value={query}
        />
        <ul className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {variant === 'status'
            ? statusGroups.map((group) => {
                const inGroup = sortByStatusGroup(filtered).filter(
                  (option) => groupOf(option) === group,
                )

                if (inGroup.length === 0) {
                  return null
                }

                return (
                  <li key={group}>
                    <p className="px-2 pt-2 pb-1 font-bold text-caption text-content-subtle uppercase">
                      {t(`statusGroup.${group}` as 'statusGroup.todo')}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {inGroup.map((option) => (
                        <li key={option.id}>
                          <OptionRow
                            active={selected.includes(option.id)}
                            onToggle={() => toggle(option.id)}
                            option={option}
                            variant={variant}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })
            : filtered.map((option) => (
                <li key={option.id}>
                  <OptionRow
                    active={selected.includes(option.id)}
                    onToggle={() => toggle(option.id)}
                    option={option}
                    variant={variant}
                  />
                </li>
              ))}
          {filtered.length === 0 && !canCreate && emptyHint ? (
            <li className="px-2 py-1.5 text-body-small text-content-subtle">
              {emptyHint}
            </li>
          ) : null}
          {canCreate ? (
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

function OptionRow({
  option,
  active,
  variant,
  onToggle,
}: Readonly<{
  option: SelectOption
  active: boolean
  variant: EditorVariant
  onToggle: () => void
}>) {
  const Chip =
    variant === 'person'
      ? PersonChip
      : variant === 'status'
        ? StatusChip
        : OptionChip

  return (
    <button
      aria-pressed={active}
      className="flex w-full cursor-pointer items-center gap-2 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
      onClick={onToggle}
      type="button"
    >
      <Chip option={option} />
      <span className="flex-1" />
      {active ? (
        <CheckIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-content-strong"
        />
      ) : null}
    </button>
  )
}

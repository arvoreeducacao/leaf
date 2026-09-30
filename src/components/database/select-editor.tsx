'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'

import { AddIcon, CancelIcon, CheckIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  type SelectOption,
  groupOf,
  sortByStatusGroup,
  statusGroups,
} from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { optionChipClass, optionDotClass } from './option-colors'

export type EditorVariant = 'option' | 'person' | 'status'

export type ChipProps = Readonly<{
  option: SelectOption
  onRemove?: () => void
  removeLabel?: string
  small?: boolean
}>

const chipSize = (small: boolean) =>
  small ? 'h-[18px] text-caption leading-[18px]' : 'h-5 text-body-small leading-5'

export function PersonChip({ option, onRemove, removeLabel, small = false }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5',
        chipSize(small),
        onRemove ? 'rounded-pill bg-surface-hover pr-1.5 pl-0.5' : null,
      )}
    >
      <UserAvatar
        image={option.image}
        name={option.name}
        userId={option.id}
      />
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

export function StatusChip({ option, onRemove, removeLabel, small = false }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-medium px-1.5 font-regular',
        chipSize(small),
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

export function OptionChip({ option, onRemove, removeLabel, small = false }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-medium px-1.5 font-regular',
        chipSize(small),
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
  const personInputRef = useRef<HTMLInputElement>(null)

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

  const trigger = (
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
  )

  if (variant === 'person') {
    return (
      <Popover onOpenChange={setOpen} open={open}>
        {trigger}
        <PopoverContent
          align="start"
          className="w-64 p-2"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            personInputRef.current?.focus()
          }}
        >
          <PersonPanel
            chosen={chosen}
            emptyHint={emptyHint}
            inputRef={personInputRef}
            onChange={onChange}
            options={options}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      {trigger}
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

function PersonPanel({
  chosen,
  inputRef,
  options,
  selected,
  emptyHint,
  onChange,
}: Readonly<{
  chosen: ReadonlyArray<SelectOption>
  inputRef: React.RefObject<HTMLInputElement | null>
  options: ReadonlyArray<SelectOption>
  selected: ReadonlyArray<string>
  emptyHint?: string
  onChange: (next: Array<string>) => void
}>) {
  const t = useTranslations('database')
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const available = useMemo(
    () =>
      options.filter(
        (option) =>
          !selected.includes(option.id) &&
          option.name.toLowerCase().includes(needle),
      ),
    [options, selected, needle],
  )

  function add(id: string) {
    onChange([...selected, id])
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(id: string) {
    onChange(selected.filter((item) => item !== id))
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && available.length > 0) {
      event.preventDefault()
      add(available[0].id)

      return
    }

    if (event.key === 'Backspace' && query.length === 0 && chosen.length > 0) {
      remove(chosen[chosen.length - 1].id)
    }
  }

  const emptyMessage =
    options.length === 0 ? emptyHint : needle.length > 0 ? t('noPeopleFound') : null

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 rounded-large border border-line-muted bg-surface-app px-1.5 py-1 transition-[color,box-shadow] focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30">
        {chosen.map((option) => (
          <PersonChip
            key={option.id}
            onRemove={() => remove(option.id)}
            option={option}
            removeLabel={t('removePerson', { name: option.name })}
          />
        ))}
        <input
          aria-label={t('searchPeople')}
          className="h-7 min-w-20 flex-1 bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-disabled"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={chosen.length === 0 ? t('searchPeople') : undefined}
          ref={inputRef}
          value={query}
        />
      </div>
      <p className="px-2 pt-2 pb-1 text-caption text-content-subtle">
        {t('selectManyPeople')}
      </p>
      <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {available.map((option) => (
          <li key={option.id}>
            <OptionRow
              active={false}
              onToggle={() => add(option.id)}
              option={option}
              variant="person"
            />
          </li>
        ))}
        {available.length === 0 && emptyMessage ? (
          <li className="px-2 py-1.5 text-body-small text-content-subtle">
            {emptyMessage}
          </li>
        ) : null}
      </ul>
    </>
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

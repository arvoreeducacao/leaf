'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import type { DatabaseProperty } from '@/db/schema'
import { type Person, optionsFor } from '@/lib/database/people'
import {
  type PropertyValue,
  type SelectOption,
  groupOf,
  sortByStatusGroup,
  statusGroups,
} from '@/lib/database/values'
import type { FilterOperator } from '@/lib/database/views'
import {
  filterOptionIds,
  foldText,
  isMultiValueType,
  isOptionFilterType,
  operatorNeedsValue,
} from '@/lib/database/views'
import { cn } from '@/shared/utils'

import { CheckMarkIcon, CloseIcon } from './icons'
import { OptionChip, PersonChip, StatusChip } from './select-editor'

type Props = Readonly<{
  property: DatabaseProperty | null
  operator: FilterOperator
  value: PropertyValue
  people: ReadonlyArray<Person>
  label?: string
  onChange: (value: PropertyValue) => void
}>

const fieldClass =
  'flex h-9 w-full min-w-0 items-center rounded-large bg-surface-input px-1.5 text-body-small text-content-strong outline-none transition-shadow tablet:h-7 focus-within:shadow-[inset_0_0_0_1px_var(--focus),0_0_0_1px_var(--focus)]'

const bareInputClass =
  'h-5 min-w-0 flex-1 bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-tertiary'

export function FilterValueInput({
  property,
  operator,
  value,
  people,
  label,
  onChange,
}: Props) {
  const t = useTranslations('database')
  const fieldLabel = label ?? t('filterValue')

  if (!operatorNeedsValue(operator)) {
    return null
  }

  if (property && property.type === 'checkbox') {
    return (
      <OptionList label={fieldLabel}>
        {[
          { id: 'true', name: t('checked') },
          { id: 'false', name: t('unchecked') },
        ].map((choice) => (
          <FilterOptionRow
            checked={(value === true) === (choice.id === 'true')}
            key={choice.id}
            onToggle={() => onChange(choice.id === 'true')}
          >
            <span className="truncate text-content-strong">{choice.name}</span>
          </FilterOptionRow>
        ))}
      </OptionList>
    )
  }

  if (property && isOptionFilterType(property.type)) {
    return (
      <FilterOptionPicker
        label={fieldLabel}
        onChange={onChange}
        people={people}
        property={property}
        value={value}
      />
    )
  }

  if (property && property.type === 'date') {
    return (
      <div className={cn(fieldClass, 'mx-3 mb-2 w-auto')}>
        <input
          aria-label={fieldLabel}
          autoFocus
          className={bareInputClass}
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={typeof value === 'string' ? value : ''}
        />
      </div>
    )
  }

  const isNumber = property?.type === 'number'

  return (
    <div className={cn(fieldClass, 'mx-3 mb-2 w-auto')}>
      <input
        aria-label={fieldLabel}
        autoFocus
        className={bareInputClass}
        inputMode={isNumber ? 'decimal' : undefined}
        onChange={(event) =>
          onChange(
            isNumber
              ? event.target.value === ''
                ? null
                : Number(event.target.value)
              : event.target.value,
          )
        }
        placeholder={t('filterValuePlaceholder')}
        type={isNumber ? 'number' : 'text'}
        value={
          value === null || value === undefined
            ? ''
            : typeof value === 'number' || typeof value === 'string'
              ? String(value)
              : ''
        }
      />
    </div>
  )
}

function FilterOptionPicker({
  property,
  value,
  people,
  label,
  onChange,
}: Readonly<{
  property: DatabaseProperty
  value: PropertyValue
  people: ReadonlyArray<Person>
  label: string
  onChange: (value: PropertyValue) => void
}>) {
  const t = useTranslations('database')
  const [query, setQuery] = useState('')

  const options = useMemo(
    () => optionsFor(property, people),
    [people, property],
  )
  const selected = filterOptionIds(value)
  const tokenized = isMultiValueType(property.type)

  const chosen = useMemo(
    () =>
      selected
        .map((id) => options.find((option) => option.id === id))
        .filter((option): option is SelectOption => option !== undefined),
    [options, selected],
  )

  const visible = useMemo(() => {
    const needle = foldText(query)

    return needle.length === 0
      ? options
      : options.filter((option) => foldText(option.name).includes(needle))
  }, [options, query])

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    )
  }

  const grouped =
    property.type === 'status'
      ? statusGroups
          .map((group) => ({
            group,
            options: sortByStatusGroup(visible).filter(
              (option) => groupOf(option) === group,
            ),
          }))
          .filter((entry) => entry.options.length > 0)
      : null

  return (
    <>
      {tokenized ? (
        <div className="px-3 pb-2">
          <div className={cn(fieldClass, 'h-auto min-h-9 py-1 tablet:min-h-7')}>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {chosen.map((option) => {
                const Token =
                  property.type === 'person' ? PersonChip : OptionChip

                return (
                  <Token
                    key={option.id}
                    onRemove={() => toggle(option.id)}
                    option={option}
                    removeLabel={t('removeFilterValue')}
                  />
                )
              })}
              <input
                aria-label={label}
                autoFocus
                className={bareInputClass}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  chosen.length > 0
                    ? ''
                    : property.type === 'person'
                      ? t('searchPeople')
                      : t('searchOption')
                }
                type="text"
                value={query}
              />
            </span>
            {chosen.length > 0 ? (
              <button
                aria-label={t('clearFilterValue')}
                className="ml-1 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-circular text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => onChange([])}
                type="button"
              >
                <CloseIcon aria-hidden="true" className="size-3" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <OptionList label={label}>
        {grouped
          ? grouped.map((entry) => (
              <li key={entry.group}>
                <p className="px-2 pt-1.5 pb-1 font-medium text-caption text-content-tertiary">
                  {t(`statusGroup.${entry.group}` as 'statusGroup.todo')}
                </p>
                <ul className="flex flex-col gap-px">
                  {entry.options.map((option) => (
                    <FilterOptionRow
                      checked={selected.includes(option.id)}
                      key={option.id}
                      onToggle={() => toggle(option.id)}
                    >
                      <StatusChip option={option} />
                    </FilterOptionRow>
                  ))}
                </ul>
              </li>
            ))
          : visible.map((option) => (
              <FilterOptionRow
                checked={selected.includes(option.id)}
                key={option.id}
                onToggle={() => toggle(option.id)}
              >
                {property.type === 'person' ? (
                  <PersonChip option={option} />
                ) : (
                  <OptionChip option={option} />
                )}
              </FilterOptionRow>
            ))}
        {visible.length === 0 ? (
          <li className="px-2 py-1.5 text-body-small text-content-tertiary">
            {t('noOptions')}
          </li>
        ) : null}
      </OptionList>

      {!tokenized && chosen.length > 0 ? (
        <div className="border-line-divider border-t p-1">
          <button
            className="flex h-9 w-full cursor-pointer items-center rounded-large px-2 text-left text-body-small text-content transition-colors tablet:h-7 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
            onClick={() => onChange([])}
            type="button"
          >
            {t('clearFilterValue')}
          </button>
        </div>
      ) : null}
    </>
  )
}

function OptionList({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <ul
      aria-label={label}
      className="flex max-h-64 flex-col gap-px overflow-y-auto p-1"
    >
      {children}
    </ul>
  )
}

function FilterOptionRow({
  checked,
  onToggle,
  children,
}: Readonly<{
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}>) {
  return (
    <li>
      <button
        aria-pressed={checked}
        className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-large px-2 text-left text-body-small transition-colors tablet:h-7 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
        onClick={onToggle}
        type="button"
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              'flex size-3.5 items-center justify-center rounded-small transition-colors',
              checked
                ? 'bg-brand text-content-inverse'
                : 'border border-line-strong',
            )}
          >
            {checked ? <CheckMarkIcon className="size-2.5" /> : null}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center">{children}</span>
      </button>
    </li>
  )
}

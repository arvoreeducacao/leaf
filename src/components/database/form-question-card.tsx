'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CancelIcon,
  CheckboxIcon,
  EllipsisIcon,
  PaperclipIcon,
  RadioButtonIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'
import {
  type FormQuestion,
  MAX_ATTACHMENTS,
  MAX_FORM_LABEL,
  MAX_FORM_TEXT,
  TITLE_QUESTION_ID,
  acceptsAttachment,
  acceptsLongAnswer,
  isQuestionableType,
} from '@/lib/database/forms'
import { parseOptions, propertyTypes } from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { InlineText } from './inline-text'
import { PropertyIcon } from './property-icon'

const MAX_ATTACHMENT_MB = 5

type Props = Readonly<{
  question: FormQuestion
  property: DatabaseProperty | null
  titleName: string
  canEdit: boolean
  first: boolean
  last: boolean
  onChange: (changes: Partial<FormQuestion>) => void
  onMove: (offset: number) => void
  onRemove: () => void
  onChangeType: (type: DatabasePropertyType) => void
  onAddOption: (name: string) => Promise<void>
  onRemoveOption: (optionId: string) => void
}>

function OptionRow({
  name,
  multiple,
  canEdit,
  onRemove,
  removeLabel,
}: Readonly<{
  name: string
  multiple: boolean
  canEdit: boolean
  onRemove: () => void
  removeLabel: string
}>) {
  const Mark = multiple ? CheckboxIcon : RadioButtonIcon

  return (
    <li className="group/option flex min-h-8 items-center gap-2">
      <Mark aria-hidden="true" className="size-4.5 shrink-0 text-content-disabled" />
      <span className="min-w-0 flex-1 truncate text-body-medium text-content-strong">
        {name}
      </span>
      {canEdit ? (
        <ButtonIcon
          aria-label={removeLabel}
          className="opacity-0 transition-opacity group-hover/option:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
          size="small"
          type="button"
          variant="ghost"
        >
          <CancelIcon aria-hidden="true" />
        </ButtonIcon>
      ) : null}
    </li>
  )
}

function AddOption({
  canEdit,
  onAdd,
  label,
  placeholder,
}: Readonly<{
  canEdit: boolean
  onAdd: (name: string) => Promise<void>
  label: string
  placeholder: string
}>) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!canEdit) {
    return null
  }

  async function commit() {
    const name = draft.trim()

    setDraft('')
    setTyping(false)

    if (name.length === 0) {
      return
    }

    setBusy(true)
    await onAdd(name)
    setBusy(false)
  }

  if (typing) {
    return (
      <li className="flex min-h-8 items-center gap-2">
        <AddIcon aria-hidden="true" className="size-4.5 shrink-0 text-content-disabled" />
        <input
          aria-label={label}
          autoFocus
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body-medium text-content-strong outline-none placeholder:text-content-disabled"
          disabled={busy}
          onBlur={() => void commit()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }

            if (event.key === 'Escape') {
              setDraft('')
              setTyping(false)
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
      </li>
    )
  }

  return (
    <li>
      <button
        className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-large text-body-medium text-content-subtle transition-colors hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
        onClick={() => setTyping(true)}
        type="button"
      >
        <AddIcon aria-hidden="true" className="size-4.5 shrink-0" />
        {label}
      </button>
    </li>
  )
}

function AnswerPreview({
  question,
  property,
  canEdit,
  onAddOption,
  onRemoveOption,
}: Readonly<
  Pick<
    Props,
    'question' | 'property' | 'canEdit' | 'onAddOption' | 'onRemoveOption'
  >
>) {
  const t = useTranslations('form')
  const type = property?.type ?? 'text'

  if (question.attachment) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 items-center gap-2 rounded-large border border-line-muted border-dashed px-3 text-body-small text-content-subtle">
          <UploadIcon aria-hidden="true" className="size-4" />
          {t('previewUpload')}
        </span>
        <span className="text-body-small text-content-subtle">
          {t('previewUploadHint', {
            files: MAX_ATTACHMENTS,
            size: MAX_ATTACHMENT_MB,
          })}
        </span>
      </div>
    )
  }

  if (type === 'select' || type === 'multiSelect' || type === 'status') {
    const options = parseOptions(property?.options)
    const multiple = type === 'multiSelect'

    return (
      <ul className="flex flex-col">
        {options.map((option) => (
          <OptionRow
            canEdit={canEdit}
            key={option.id}
            multiple={multiple}
            name={option.name}
            onRemove={() => onRemoveOption(option.id)}
            removeLabel={t('removeOption')}
          />
        ))}
        <AddOption
          canEdit={canEdit}
          label={t('addOption')}
          onAdd={onAddOption}
          placeholder={t('optionName')}
        />
      </ul>
    )
  }

  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <CheckboxIcon aria-hidden="true" className="size-4.5 text-content-disabled" />
        <span className="text-body-medium text-content-subtle">
          {t('previewCheckbox')}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full items-start rounded-large border border-line-muted border-dashed px-3 py-2 text-body-medium text-content-disabled',
        question.long ? 'min-h-24' : 'min-h-11',
      )}
    >
      {t('previewAnswer')}
    </div>
  )
}

export function FormQuestionCard({
  question,
  property,
  titleName,
  canEdit,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  onChangeType,
  onAddOption,
  onRemoveOption,
}: Props) {
  const t = useTranslations('form')
  const tDatabase = useTranslations('database')
  const isTitle = question.propertyId === TITLE_QUESTION_ID
  const missing = !isTitle && property === null
  const name = isTitle ? titleName : (property?.name ?? question.propertyId)
  const type = property?.type ?? 'text'
  const [describing, setDescribing] = useState(question.description.length > 0)
  const showDescription = describing || question.description.length > 0
  const selectable =
    !question.attachment &&
    (type === 'select' || type === 'multiSelect' || type === 'status')

  return (
    <li
      className={cn(
        'group/question relative flex flex-col gap-3 rounded-xlarge border bg-surface-card px-6 py-5 transition-colors',
        missing
          ? 'border-destructive'
          : 'border-line-muted hover:border-line-stronger',
      )}
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        {missing ? (
          <span className="text-body-small text-destructive">
            {t('questionMissing')}
          </span>
        ) : null}

        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ButtonIcon
                aria-label={t('questionMenu', { name })}
                className="opacity-0 transition-opacity group-hover/question:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
                size="medium"
                type="button"
                variant="ghost"
              >
                <EllipsisIcon aria-hidden="true" />
              </ButtonIcon>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>{t('questionOptions')}</DropdownMenuLabel>

              <DropdownMenuCheckboxItem
                checked={question.required}
                onCheckedChange={(checked) => onChange({ required: checked })}
                onSelect={(event) => event.preventDefault()}
              >
                {t('required')}
              </DropdownMenuCheckboxItem>

              <DropdownMenuCheckboxItem
                checked={showDescription}
                onCheckedChange={(checked) => {
                  setDescribing(checked)

                  if (!checked) {
                    onChange({ description: '' })
                  }
                }}
                onSelect={(event) => event.preventDefault()}
              >
                {t('questionDescription')}
              </DropdownMenuCheckboxItem>

              {acceptsLongAnswer(type) && !question.attachment ? (
                <DropdownMenuCheckboxItem
                  checked={question.long}
                  onCheckedChange={(checked) => onChange({ long: checked })}
                  onSelect={(event) => event.preventDefault()}
                >
                  {t('longAnswer')}
                </DropdownMenuCheckboxItem>
              ) : null}

              {acceptsAttachment(type) ? (
                <DropdownMenuCheckboxItem
                  checked={question.attachment}
                  onCheckedChange={(checked) =>
                    onChange({
                      attachment: checked,
                      long: checked ? false : question.long,
                    })
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  <PaperclipIcon aria-hidden="true" />
                  {t('asAttachment')}
                </DropdownMenuCheckboxItem>
              ) : null}

              {isTitle || missing ? null : (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {t('questionType')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel>
                      {tDatabase('propertyTypeLabel')}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      onValueChange={(value) =>
                        onChangeType(value as DatabasePropertyType)
                      }
                      value={type}
                    >
                      {propertyTypes
                        .filter((item) => isQuestionableType(item))
                        .map((item) => (
                          <DropdownMenuRadioItem key={item} value={item}>
                            <PropertyIcon type={item} />
                            {tDatabase(`type_${item}`)}
                          </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                disabled={first}
                onSelect={() => onMove(-1)}
              >
                <ArrowUpIcon aria-hidden="true" />
                {t('moveUp')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>
                <ArrowDownIcon aria-hidden="true" />
                {t('moveDown')}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={onRemove} variant="destructive">
                <TrashIcon aria-hidden="true" />
                {t('removeQuestion')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <InlineText
        ariaLabel={t('questionLabel')}
        className="pr-10 font-semibold text-content-strong text-heading-medium"
        disabled={!canEdit}
        maxLength={MAX_FORM_LABEL}
        onChange={(value) => onChange({ label: value })}
        placeholder={name}
        solidPlaceholder
        suffix={
          question.required ? (
            <span className="text-content-subtle">*</span>
          ) : null
        }
        value={question.label}
      />

      {showDescription ? (
        <InlineText
          ariaLabel={t('questionDescription')}
          className="text-body-medium text-content"
          disabled={!canEdit}
          maxLength={MAX_FORM_TEXT}
          multiline
          onChange={(value) => onChange({ description: value })}
          placeholder={t('questionDescriptionHint')}
          value={question.description}
        />
      ) : null}

      {selectable ? (
        <p className="text-body-small text-content-subtle">
          {type === 'multiSelect' ? t('selectManyHint') : t('selectOneHint')}
        </p>
      ) : null}

      <AnswerPreview
        canEdit={canEdit}
        onAddOption={onAddOption}
        onRemoveOption={onRemoveOption}
        property={property}
        question={question}
      />
    </li>
  )
}

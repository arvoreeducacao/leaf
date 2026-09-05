'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { FormField } from '@/components/forms/form-field'
import { AddIcon, LockIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DatabaseProperty, DatabasePropertyType, DatabaseView } from '@/db/schema'
import {
  type FormConfig,
  type FormQuestion,
  MAX_FORM_LABEL,
  MAX_FORM_TEXT,
  TITLE_QUESTION_ID,
  isQuestionableType,
  resolveQuestions,
} from '@/lib/database/forms'
import {
  emptyValueFor,
  type PropertyValue,
  propertyTypes,
} from '@/lib/database/values'
import { cn } from '@/shared/utils'

import { FormLinkPanel } from './form-link-panel'
import { FormQuestionCard } from './form-question-card'
import { InlineText } from './inline-text'
import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  view: DatabaseView
  properties: ReadonlyArray<DatabaseProperty>
  config: FormConfig
  canEdit: boolean
  databaseTitle: string
  databaseIcon: string | null
  previewing: boolean
  onChange: (config: FormConfig) => void
  onTokenChange: (token: string | null) => void
  onAddOption: (propertyId: string, name: string) => Promise<void>
  onRemoveOption: (propertyId: string, optionId: string) => void
  onChangePropertyType: (
    propertyId: string,
    type: DatabasePropertyType,
  ) => void
  onAddProperty: (type: DatabasePropertyType) => Promise<string | null>
  hasOrganization: boolean
  compact?: boolean
}>

function move<T>(items: ReadonlyArray<T>, from: number, to: number): Array<T> {
  if (to < 0 || to >= items.length) {
    return [...items]
  }

  const next = [...items]
  const [moved] = next.splice(from, 1)

  next.splice(to, 0, moved)

  return next
}

function FormPreview({
  config,
  properties,
  titleName,
  databaseTitle,
  databaseIcon,
  publicToken,
}: Readonly<{
  config: FormConfig
  properties: ReadonlyArray<DatabaseProperty>
  titleName: string
  databaseTitle: string
  databaseIcon: string | null
  publicToken: string | null
}>) {
  const t = useTranslations('form')
  const questions = resolveQuestions(config, properties, titleName)
  const [answers, setAnswers] = useState<Record<string, PropertyValue>>({})
  const uploadPath = publicToken ? `/api/forms/${publicToken}/uploads` : ''

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        {databaseIcon ? (
          <DocumentIcon
            className="size-10"
            icon={databaseIcon}
            kind="database"
          />
        ) : null}
        <h1 className="font-heavy text-content-strong text-display-small">
          {config.headline.length > 0 ? config.headline : databaseTitle}
        </h1>
        {config.intro.length > 0 ? (
          <p className="whitespace-pre-line text-body-medium text-content">
            {config.intro}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        {questions.map((question) => (
          <FormField
            disabled={question.attachment && uploadPath.length === 0}
            invalid={false}
            key={question.propertyId}
            onChange={(value) =>
              setAnswers((current) => ({
                ...current,
                [question.propertyId]: value,
              }))
            }
            question={question}
            uploadPath={uploadPath}
            value={
              answers[question.propertyId] ??
              (question.attachment ? [] : emptyValueFor(question.type))
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button className="self-start" disabled type="button">
          {config.submitLabel.length > 0 ? config.submitLabel : t('submit')}
        </Button>
        <p className="text-body-small text-content-subtle">
          {t('previewHint')}
        </p>
      </div>
    </section>
  )
}

export function FormEditor({
  view,
  properties,
  config,
  canEdit,
  databaseTitle,
  databaseIcon,
  previewing,
  onChange,
  onTokenChange,
  onAddOption,
  onRemoveOption,
  onChangePropertyType,
  onAddProperty,
  hasOrganization,
  compact = false,
}: Props) {
  const t = useTranslations('form')
  const tDatabase = useTranslations('database')
  const titleName = tDatabase('titleColumn')

  const byId = new Map(properties.map((property) => [property.id, property]))
  const used = new Set(config.questions.map((question) => question.propertyId))

  const available = [
    ...(used.has(TITLE_QUESTION_ID)
      ? []
      : [{ id: TITLE_QUESTION_ID, name: titleName, type: null }]),
    ...properties
      .filter(
        (property) =>
          isQuestionableType(property.type) && !used.has(property.id),
      )
      .map((property) => ({
        id: property.id,
        name: property.name,
        type: property.type,
      })),
  ]

  const offeredTypes = propertyTypes.filter(
    (type) =>
      isQuestionableType(type) && (hasOrganization || type !== 'person'),
  )

  const gutter = compact ? '' : 'px-4 tablet:px-10'

  function setQuestions(questions: ReadonlyArray<FormQuestion>) {
    onChange({ ...config, questions })
  }

  function addQuestion(propertyId: string) {
    setQuestions([
      ...config.questions,
      {
        propertyId,
        label: '',
        description: '',
        required: false,
        attachment: false,
        long: false,
      },
    ])
  }

  async function addFromNewProperty(type: DatabasePropertyType) {
    const propertyId = await onAddProperty(type)

    if (propertyId) {
      addQuestion(propertyId)
    }
  }

  function patchQuestion(index: number, changes: Partial<FormQuestion>) {
    setQuestions(
      config.questions.map((question, position) =>
        position === index ? { ...question, ...changes } : question,
      ),
    )
  }

  const linkOff = view.publicToken === null
  const bannerText = linkOff
    ? t('bannerLinkOff')
    : config.accepting
      ? t('bannerPublic')
      : t('bannerClosed')

  return (
    <div className={cn('flex justify-center py-8', gutter)}>
      <div className="flex w-full max-w-150 flex-col gap-6">
        {previewing ? (
          <FormPreview
            config={config}
            databaseIcon={databaseIcon}
            databaseTitle={databaseTitle}
            properties={properties}
            publicToken={view.publicToken}
            titleName={titleName}
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {databaseIcon ? (
                <DocumentIcon
                  className="size-12"
                  icon={databaseIcon}
                  kind="database"
                />
              ) : null}

              <InlineText
                ariaLabel={t('headline')}
                className="font-heavy text-content-strong text-display-medium"
                disabled={!canEdit}
                maxLength={MAX_FORM_LABEL}
                onChange={(value) => onChange({ ...config, headline: value })}
                placeholder={databaseTitle}
                solidPlaceholder
                value={config.headline}
              />

              <InlineText
                ariaLabel={t('intro')}
                className="text-body-medium text-content"
                disabled={!canEdit}
                maxLength={MAX_FORM_TEXT}
                multiline
                onChange={(value) => onChange({ ...config, intro: value })}
                placeholder={t('introPlaceholder')}
                value={config.intro}
              />
            </div>

            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-xlarge px-4 py-3',
                linkOff || !config.accepting
                  ? 'bg-surface-subtle'
                  : 'bg-warning-100 dark:bg-warning-950',
              )}
            >
              <p
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 text-body-small',
                  linkOff || !config.accepting
                    ? 'text-content'
                    : 'text-warning-900 dark:text-warning-200',
                )}
              >
                {linkOff || !config.accepting ? (
                  <LockIcon aria-hidden="true" className="size-4 shrink-0" />
                ) : null}
                {bannerText}
              </p>

              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="shrink-0 cursor-pointer rounded-large font-medium text-body-small text-content-strong underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                      type="button"
                    >
                      {t('bannerChange')}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-90 p-3">
                    <FormLinkPanel
                      onTokenChange={onTokenChange}
                      view={view}
                    />
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>

            {config.questions.length === 0 ? (
              <p className="text-body-small text-content">{t('noQuestions')}</p>
            ) : null}

            <ul className="flex flex-col gap-4">
              {config.questions.map((question, index) => (
                <FormQuestionCard
                  canEdit={canEdit}
                  first={index === 0}
                  key={question.propertyId}
                  last={index === config.questions.length - 1}
                  onAddOption={(name) =>
                    onAddOption(question.propertyId, name)
                  }
                  onChange={(changes) => patchQuestion(index, changes)}
                  onChangeType={(type) =>
                    onChangePropertyType(question.propertyId, type)
                  }
                  onMove={(offset) =>
                    setQuestions(move(config.questions, index, index + offset))
                  }
                  onRemove={() =>
                    setQuestions(
                      config.questions.filter(
                        (item) => item.propertyId !== question.propertyId,
                      ),
                    )
                  }
                  onRemoveOption={(optionId) =>
                    onRemoveOption(question.propertyId, optionId)
                  }
                  property={byId.get(question.propertyId) ?? null}
                  question={question}
                  titleName={titleName}
                />
              ))}
            </ul>

            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t('addQuestion')}
                    className="flex h-9 cursor-pointer items-center justify-center gap-2 self-center rounded-pill px-4 font-medium text-body-small text-content-subtle transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                    type="button"
                  >
                    <AddIcon aria-hidden="true" className="size-5" />
                    {t('addQuestion')}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-60">
                  {available.length > 0 ? (
                    <>
                      <DropdownMenuLabel>
                        {t('useProperty')}
                      </DropdownMenuLabel>
                      {available.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onSelect={() => addQuestion(item.id)}
                        >
                          <PropertyIcon type={item.type ?? 'text'} />
                          {item.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {tDatabase('addProperty')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {offeredTypes.map((type) => (
                        <DropdownMenuItem
                          key={type}
                          onSelect={() => void addFromNewProperty(type)}
                        >
                          <PropertyIcon type={type} />
                          {tDatabase(`type_${type}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

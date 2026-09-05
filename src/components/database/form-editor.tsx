'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CancelIcon,
  LightningIcon,
  PaperclipIcon,
  ShareIcon,
  TrashIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { DatabaseProperty, DatabaseView } from '@/db/schema'
import {
  type AutomationKind,
  type FormAutomation,
  type FormConfig,
  type FormQuestion,
  TITLE_QUESTION_ID,
  acceptsAttachment,
  acceptsLongAnswer,
  automationAccepts,
  automationKinds,
  isQuestionableType,
} from '@/lib/database/forms'
import type { PropertyValue } from '@/lib/database/values'
import { disableFormLink, enableFormLink } from '@/lib/form-actions'
import { cn } from '@/shared/utils'

import { FilterValueInput } from './filter-value-input'
import { PropertyIcon } from './property-icon'

type Props = Readonly<{
  view: DatabaseView
  properties: ReadonlyArray<DatabaseProperty>
  config: FormConfig
  canEdit: boolean
  onChange: (config: FormConfig) => void
  onTokenChange: (token: string | null) => void
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

export function FormEditor({
  view,
  properties,
  config,
  canEdit,
  onChange,
  onTokenChange,
  compact = false,
}: Props) {
  const t = useTranslations('form')
  const tDatabase = useTranslations('database')
  const [busy, setBusy] = useState(false)

  const byId = new Map(properties.map((property) => [property.id, property]))
  const used = new Set(config.questions.map((question) => question.propertyId))

  const available = [
    ...(used.has(TITLE_QUESTION_ID)
      ? []
      : [{ id: TITLE_QUESTION_ID, name: tDatabase('titleColumn') }]),
    ...properties
      .filter(
        (property) =>
          isQuestionableType(property.type) && !used.has(property.id),
      )
      .map((property) => ({ id: property.id, name: property.name })),
  ]

  const formUrl =
    view.publicToken && typeof window !== 'undefined'
      ? new URL(`/form/${view.publicToken}`, window.location.origin).toString()
      : null

  function setQuestions(questions: ReadonlyArray<FormQuestion>) {
    onChange({ ...config, questions })
  }

  function patchQuestion(index: number, changes: Partial<FormQuestion>) {
    setQuestions(
      config.questions.map((question, position) =>
        position === index ? { ...question, ...changes } : question,
      ),
    )
  }

  function setAutomations(automations: ReadonlyArray<FormAutomation>) {
    onChange({ ...config, automations })
  }

  async function toggleLink(next: boolean) {
    setBusy(true)

    try {
      const result = next
        ? await enableFormLink(view.id)
        : await disableFormLink(view.id)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      onTokenChange(result.token)
    } catch {
      toast.error(tDatabase('saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!formUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(formUrl)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  function nameOf(propertyId: string) {
    return propertyId === TITLE_QUESTION_ID
      ? tDatabase('titleColumn')
      : (byId.get(propertyId)?.name ?? propertyId)
  }

  function patchAutomation(index: number, value: PropertyValue) {
    setAutomations(
      config.automations.map((automation, position) =>
        position === index ? { ...automation, value } : automation,
      ),
    )
  }

  function automationTargets(kind: AutomationKind) {
    return properties.filter((property) =>
      automationAccepts(kind, property.type),
    )
  }

  const gutter = compact ? '' : 'px-4 tablet:px-24'

  return (
    <div className={cn('flex flex-col gap-8 py-4', gutter)}>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium text-caption text-content-subtle">
            {t('linkSection')}
          </h3>
          <p className="text-body-small text-content">{t('linkHint')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <Switch
              checked={view.publicToken !== null}
              disabled={!canEdit || busy}
              onCheckedChange={(checked) => void toggleLink(checked)}
            />
            <span className="text-body-small text-content-strong">
              {t('linkEnabled')}
            </span>
          </label>

          {formUrl ? (
            <>
              <code className="max-w-full truncate rounded-large border border-line-muted bg-surface-card px-2 py-1 text-body-small text-content">
                {formUrl}
              </code>
              <Button onClick={() => void copyLink()} type="button" variant="secondary">
                <ShareIcon aria-hidden="true" className="size-4" />
                {t('copyLink')}
              </Button>
            </>
          ) : null}
        </div>

        <label className="flex items-center gap-2">
          <Switch
            checked={config.accepting}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              onChange({ ...config, accepting: checked })
            }
          />
          <span className="text-body-small text-content-strong">
            {t('acceptingResponses')}
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-medium text-caption text-content-subtle">
          {t('presentationSection')}
        </h3>

        <label className="flex flex-col gap-1">
          <span className="text-body-small text-content">{t('headline')}</span>
          <Input
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...config, headline: event.target.value })
            }
            value={config.headline}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-small text-content">{t('intro')}</span>
          <Textarea
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...config, intro: event.target.value })
            }
            resizable
            value={config.intro}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-small text-content">
            {t('submitLabel')}
          </span>
          <Input
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...config, submitLabel: event.target.value })
            }
            placeholder={t('submit')}
            value={config.submitLabel}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-body-small text-content">
            {t('successMessage')}
          </span>
          <Textarea
            disabled={!canEdit}
            onChange={(event) =>
              onChange({ ...config, successMessage: event.target.value })
            }
            resizable
            value={config.successMessage}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-caption text-content-subtle">
            {t('questionsSection')}
          </h3>

          {canEdit && available.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary">
                  <AddIcon aria-hidden="true" className="size-4" />
                  {t('addQuestion')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {available.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() =>
                      setQuestions([
                        ...config.questions,
                        {
                          propertyId: item.id,
                          label: '',
                          description: '',
                          required: false,
                          attachment: false,
                          long: false,
                        },
                      ])
                    }
                  >
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {config.questions.length === 0 ? (
          <p className="text-body-small text-content">{t('noQuestions')}</p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {config.questions.map((question, index) => {
            const property = byId.get(question.propertyId) ?? null
            const missing =
              question.propertyId !== TITLE_QUESTION_ID && property === null

            return (
              <li
                className="flex flex-col gap-3 rounded-large border border-line-muted bg-surface-card p-3"
                key={question.propertyId}
              >
                <div className="flex items-center gap-2">
                  {property ? (
                    <PropertyIcon
                      className="size-4 text-content-subtle"
                      type={property.type}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-medium text-body-small text-content-strong">
                    {nameOf(question.propertyId)}
                  </span>

                  {missing ? (
                    <span className="text-body-small text-destructive">
                      {t('questionMissing')}
                    </span>
                  ) : null}

                  <ButtonIcon
                    aria-label={t('moveUp')}
                    disabled={!canEdit || index === 0}
                    onClick={() =>
                      setQuestions(move(config.questions, index, index - 1))
                    }
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </ButtonIcon>

                  <ButtonIcon
                    aria-label={t('moveDown')}
                    disabled={!canEdit || index === config.questions.length - 1}
                    onClick={() =>
                      setQuestions(move(config.questions, index, index + 1))
                    }
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </ButtonIcon>

                  <ButtonIcon
                    aria-label={t('removeQuestion')}
                    disabled={!canEdit}
                    onClick={() =>
                      setQuestions(
                        config.questions.filter(
                          (item) => item.propertyId !== question.propertyId,
                        ),
                      )
                    }
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    <CancelIcon aria-hidden="true" />
                  </ButtonIcon>
                </div>

                <Input
                  aria-label={t('questionLabel')}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchQuestion(index, { label: event.target.value })
                  }
                  placeholder={nameOf(question.propertyId)}
                  value={question.label}
                />

                <Textarea
                  aria-label={t('questionDescription')}
                  disabled={!canEdit}
                  onChange={(event) =>
                    patchQuestion(index, { description: event.target.value })
                  }
                  placeholder={t('questionDescriptionHint')}
                  value={question.description}
                />

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={question.required}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        patchQuestion(index, { required: checked })
                      }
                    />
                    <span className="text-body-small text-content">
                      {t('required')}
                    </span>
                  </label>

                  {property &&
                  acceptsLongAnswer(property.type) &&
                  !question.attachment ? (
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={question.long}
                        disabled={!canEdit}
                        onCheckedChange={(checked) =>
                          patchQuestion(index, { long: checked })
                        }
                      />
                      <span className="text-body-small text-content">
                        {t('longAnswer')}
                      </span>
                    </label>
                  ) : null}

                  {property && acceptsAttachment(property.type) ? (
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={question.attachment}
                        disabled={!canEdit}
                        onCheckedChange={(checked) =>
                          patchQuestion(index, {
                            attachment: checked,
                            long: checked ? false : question.long,
                          })
                        }
                      />
                      <span className="flex items-center gap-1 text-body-small text-content">
                        <PaperclipIcon aria-hidden="true" className="size-4" />
                        {t('asAttachment')}
                      </span>
                    </label>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-1 font-medium text-caption text-content-subtle">
              <LightningIcon aria-hidden="true" className="size-4" />
              {t('automationsSection')}
            </h3>
            <p className="text-body-small text-content">
              {t('automationsHint')}
            </p>
          </div>

          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary">
                  <AddIcon aria-hidden="true" className="size-4" />
                  {t('addAutomation')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {automationKinds.map((kind) => {
                  const targets = automationTargets(kind)

                  return (
                    <div key={kind}>
                      <DropdownMenuLabel>
                        {t(`automation_${kind}`)}
                      </DropdownMenuLabel>
                      {targets.length === 0 ? (
                        <DropdownMenuItem disabled>
                          {t('automationNoTarget')}
                        </DropdownMenuItem>
                      ) : (
                        targets.map((property) => (
                          <DropdownMenuItem
                            key={`${kind}-${property.id}`}
                            onSelect={() =>
                              setAutomations([
                                ...config.automations,
                                { kind, propertyId: property.id, value: null },
                              ])
                            }
                          >
                            {property.name}
                          </DropdownMenuItem>
                        ))
                      )}
                      <DropdownMenuSeparator />
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {config.automations.length === 0 ? (
          <p className="text-body-small text-content">{t('noAutomations')}</p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {config.automations.map((automation, index) => (
            <li
              className="flex items-center gap-2 rounded-large border border-line-muted bg-surface-card px-3 py-2"
              key={`${automation.kind}-${automation.propertyId}-${index}`}
            >
              <LightningIcon
                aria-hidden="true"
                className="size-4 text-content-subtle"
              />
              <span className="min-w-0 flex-1 text-body-small text-content-strong">
                {t(`automationLine_${automation.kind}`, {
                  property: nameOf(automation.propertyId),
                })}
              </span>

              {automation.kind === 'presetValue' ? (
                <div className="w-44 shrink-0">
                  <FilterValueInput
                    label={t('automationValue')}
                    onChange={(value) => patchAutomation(index, value)}
                    operator="is"
                    people={[]}
                    property={byId.get(automation.propertyId) ?? null}
                    value={automation.value}
                  />
                </div>
              ) : null}

              <ButtonIcon
                aria-label={t('removeAutomation')}
                disabled={!canEdit}
                onClick={() =>
                  setAutomations(
                    config.automations.filter(
                      (_, position) => position !== index,
                    ),
                  )
                }
                size="small"
                type="button"
                variant="ghost"
              >
                <TrashIcon aria-hidden="true" />
              </ButtonIcon>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

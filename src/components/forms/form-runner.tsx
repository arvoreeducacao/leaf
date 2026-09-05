'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { CheckIcon, LockIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { emptyValueFor, type PropertyValue } from '@/lib/database/values'
import { submitForm } from '@/lib/form-actions'
import type { PublicForm } from '@/lib/forms'

import { FormField } from './form-field'

type Answers = Record<string, PropertyValue>

function initialAnswers(form: PublicForm): Answers {
  const answers: Answers = {}

  for (const question of form.questions) {
    answers[question.propertyId] = question.attachment
      ? []
      : emptyValueFor(question.type)
  }

  return answers
}

export function FormRunner({ form }: Readonly<{ form: PublicForm }>) {
  const t = useTranslations('form')
  const [answers, setAnswers] = useState<Answers>(() => initialAnswers(form))
  const [missing, setMissing] = useState<ReadonlyArray<string>>([])
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const headline =
    form.config.headline.length > 0 ? form.config.headline : form.databaseTitle

  const heading = (
    <div className="flex flex-col gap-3">
      {form.databaseIcon ? (
        <DocumentIcon
          className="size-10"
          icon={form.databaseIcon}
          kind="database"
        />
      ) : null}
      <h1 className="font-heavy text-content-strong text-display-small">
        {headline}
      </h1>
      {form.config.intro.length > 0 ? (
        <p className="whitespace-pre-line text-body-medium text-content">
          {form.config.intro}
        </p>
      ) : null}
    </div>
  )

  if (!form.config.accepting) {
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <div className="flex items-start gap-2 rounded-large border border-line-muted bg-surface-card p-4">
          <LockIcon aria-hidden="true" className="mt-0.5 size-5 text-content-subtle" />
          <p className="text-body-medium text-content">{t('closed')}</p>
        </div>
      </section>
    )
  }

  if (sent) {
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <div className="flex items-start gap-2 rounded-large border border-line-muted bg-surface-card p-4">
          <CheckIcon aria-hidden="true" className="mt-0.5 size-5 text-brand" />
          <p className="text-body-medium text-content-strong" role="status">
            {form.config.successMessage.length > 0
              ? form.config.successMessage
              : t('defaultSuccess')}
          </p>
        </div>
        <Button
          className="self-start"
          onClick={() => {
            setAnswers(initialAnswers(form))
            setSent(false)
          }}
          type="button"
          variant="secondary"
        >
          {t('sendAnother')}
        </Button>
      </section>
    )
  }

  async function send() {
    setSending(true)
    setFailure('')

    try {
      const result = await submitForm(form.token, answers)

      if (!result.ok) {
        setMissing(result.missing ?? [])
        setFailure(result.error)

        return
      }

      setMissing([])
      setSent(true)
    } catch {
      setFailure(t('sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      {heading}

      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        {form.questions.map((question) => (
          <FormField
            disabled={sending}
            invalid={missing.includes(question.propertyId)}
            key={question.propertyId}
            onChange={(value) => {
              setAnswers((current) => ({
                ...current,
                [question.propertyId]: value,
              }))
              setMissing((current) =>
                current.filter((item) => item !== question.propertyId),
              )
            }}
            question={question}
            uploadPath={`/api/forms/${form.token}/uploads`}
            value={answers[question.propertyId] ?? null}
          />
        ))}

        {failure.length > 0 ? (
          <p className="text-body-small text-destructive" role="alert">
            {failure}
          </p>
        ) : null}

        <Button className="self-start" disabled={sending} type="submit">
          {sending
            ? t('sending')
            : form.config.submitLabel.length > 0
              ? form.config.submitLabel
              : t('submit')}
        </Button>
      </form>
    </section>
  )
}

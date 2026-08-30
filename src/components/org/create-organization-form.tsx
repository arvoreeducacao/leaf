'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { TeamIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOrganization } from '@/lib/org-actions'

export function CreateOrganizationForm() {
  const t = useTranslations('org')
  const router = useRouter()
  const nameId = useId()
  const errorId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0) {
      setError(t('errorEmptyName'))

      return
    }

    setPending(true)
    const result = await createOrganization(name)
    setPending(false)

    if (!result.ok) {
      setError(result.error)

      return
    }

    toast.success(t('created'))
    router.refresh()
  }

  return (
    <section className="mx-auto flex max-w-130 flex-col gap-6 rounded-xlarge border border-line-subtle bg-surface-nav px-4 py-8 tablet:px-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <TeamIcon aria-hidden="true" className="size-10 text-brand" />
        <h1 className="font-bold text-heading-large text-content-strong">
          {t('createTitle')}
        </h1>
        <p className="text-body-medium text-content">{t('createSubtitle')}</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={submit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={nameId}>{t('nameLabel')}</Label>
          <Input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="organization"
            className="max-w-full"
            disabled={pending}
            id={nameId}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            value={name}
          />
        </div>

        {error ? (
          <p
            className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
            id={errorId}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button aria-busy={pending} disabled={pending} type="submit">
          {t('create')}
        </Button>
      </form>

      <p className="text-body-small text-content">{t('createHelp')}</p>
    </section>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { ShareIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { DatabaseView } from '@/db/schema'
import { disableFormLink, enableFormLink } from '@/lib/form-actions'

type Props = Readonly<{
  view: DatabaseView
  onTokenChange: (token: string | null) => void
}>

export function formUrlOf(view: DatabaseView): string | null {
  return view.publicToken && typeof window !== 'undefined'
    ? new URL(`/form/${view.publicToken}`, window.location.origin).toString()
    : null
}

export function FormLinkPanel({ view, onTokenChange }: Props) {
  const t = useTranslations('form')
  const tDatabase = useTranslations('database')
  const [busy, setBusy] = useState(false)
  const formUrl = formUrlOf(view)

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-caption text-content-subtle">
          {t('linkSection')}
        </h3>
        <p className="text-body-small text-content">{t('linkHint')}</p>
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-body-small text-content-strong">
          {t('linkEnabled')}
        </span>
        <Switch
          checked={view.publicToken !== null}
          disabled={busy}
          onCheckedChange={(checked) => void toggleLink(checked)}
        />
      </label>

      {formUrl ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-large border border-line-muted bg-surface-app px-2 py-1.5 text-body-small text-content">
            {formUrl}
          </code>
          <Button
            onClick={() => void copyLink()}
            type="button"
            variant="secondary"
          >
            <ShareIcon aria-hidden="true" className="size-4" />
            {t('copyLink')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

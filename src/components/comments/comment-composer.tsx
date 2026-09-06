'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { CaretUpCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import { cn } from '@/shared/utils'

export type CommentViewer = Readonly<{
  id: string
  name: string
  image: string | null
}>

type Props = Readonly<{
  viewer: CommentViewer
  label: string
  placeholder: string
  disabled: boolean
  autoFocus?: boolean
  className?: string
  fieldTestId: string
  submitTestId: string
  onSubmit: (body: string) => Promise<boolean>
}>

export function CommentComposer({
  viewer,
  label,
  placeholder,
  disabled,
  autoFocus,
  className,
  fieldTestId,
  submitTestId,
  onSubmit,
}: Props) {
  const t = useTranslations('comments')
  const fieldId = useId()

  const [draft, setDraft] = useState('')

  function grow(field: HTMLTextAreaElement) {
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }

  async function submit() {
    if (draft.trim().length === 0) {
      return
    }

    if (await onSubmit(draft)) {
      setDraft('')
    }
  }

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <UserAvatar
        className="size-6"
        image={viewer.image}
        name={viewer.name}
        userId={viewer.id}
      />
      <label className="sr-only" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        autoFocus={autoFocus}
        className="min-h-6 flex-1 resize-none bg-transparent py-0.5 text-body-small text-content-strong outline-none placeholder:text-content-muted"
        data-testid={fieldTestId}
        disabled={disabled}
        id={fieldId}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(event) => {
          setDraft(event.target.value)
          grow(event.target)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void submit()
          }
        }}
        placeholder={placeholder}
        rows={1}
        value={draft}
      />
      <Button
        aria-label={t('sendComment')}
        className="size-6 p-0.5 text-content-muted enabled:text-link"
        data-testid={submitTestId}
        disabled={disabled || draft.trim().length === 0}
        onClick={() => void submit()}
        size="icon"
        title={t('sendComment')}
        type="button"
        variant="ghost"
      >
        <CaretUpCircleIcon aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}

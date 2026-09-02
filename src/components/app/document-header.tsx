'use client'

import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { DocumentIcon } from '@/components/app/document-icon'
import { DocumentMenu } from '@/components/app/document-menu'
import { DocumentStatus } from '@/components/app/document-status'
import { PresenceIndicator } from '@/components/app/presence-indicator'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { CommentsPanel } from '@/components/comments/comments-panel'
import {
  documentTitleInputId,
  requestEditorFocus,
} from '@/components/editor/focus-bridge'
import {
  CaretRightIcon,
  ClipboardContentIcon,
  TeamIcon,
  UsersIcon,
} from '@/components/icons'
import { ShareButton } from '@/components/sharing/share-button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { renameDocument } from '@/lib/document-actions'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documentId: string
  title: string
  canEdit: boolean
  isOwner: boolean
  canMoveToTeamspace: boolean
  teamspaceName: string | null
  sharedWithOrganization: boolean
  openComments: number
  breadcrumb: React.ReactNode
  wide?: boolean
  icon?: string | null
  kind?: 'page' | 'database' | 'row'
  updatedAt?: Date | null
}>

export function DocumentHeader({
  documentId,
  title,
  canEdit,
  isOwner,
  canMoveToTeamspace,
  teamspaceName,
  sharedWithOrganization,
  openComments,
  breadcrumb,
  wide = false,
  icon = null,
  kind = 'page',
  updatedAt = null,
}: Props) {
  const t = useTranslations('document')
  const tTeamspace = useTranslations('teamspace')
  const format = useFormatter()
  const now = useNow()
  const titleId = documentTitleInputId
  const slot = useTopbarSlot()
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(title)
  const loadedFor = useRef(documentId)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const fitToContent = useCallback(() => {
    const field = fieldRef.current

    if (!field) {
      return
    }

    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [])

  useEffect(fitToContent, [fitToContent, value])

  useEffect(() => {
    if (loadedFor.current === documentId) {
      return
    }

    loadedFor.current = documentId
    setValue(title)
    lastSaved.current = title
  }, [documentId, title])

  async function persist() {
    const next = value.trim()

    if (next === lastSaved.current) {
      return
    }

    setSaving(true)
    const result = await renameDocument(documentId, next)
    setSaving(false)

    if (result.ok) {
      lastSaved.current = next.length > 0 ? next : t('untitled')
      setValue(lastSaved.current)
    } else {
      setValue(lastSaved.current)
      toast.error(result.error)
    }
  }

  const topbar = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1 text-body-small text-content">
        {sharedWithOrganization ? (
          <>
            <span
              className="inline-flex shrink-0 items-center rounded-large px-1.5 py-0.5"
              data-testid="document-org-tag"
              title={t('orgTagHint')}
            >
              <TeamIcon aria-hidden="true" className="mr-1.5 size-4 shrink-0" />
              {t('orgTag')}
            </span>
            <CaretRightIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-content-disabled"
            />
          </>
        ) : null}
        {teamspaceName ? (
          <>
            <span
              className="inline-flex min-w-0 max-w-40 shrink items-center rounded-large px-1.5 py-0.5"
              data-testid="document-teamspace-tag"
              title={tTeamspace('badgeHint')}
            >
              <UsersIcon aria-hidden="true" className="mr-1.5 size-4 shrink-0" />
              <span className="min-w-0 truncate">{teamspaceName}</span>
            </span>
            <CaretRightIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-content-disabled"
            />
          </>
        ) : null}
        {breadcrumb}
        {breadcrumb ? (
          <CaretRightIcon
            aria-hidden="true"
            className="size-3 shrink-0 text-content-disabled"
          />
        ) : null}
        <span className="inline-flex min-w-0 items-center rounded-large px-1.5 py-0.5 text-content-strong">
          <DocumentIcon className="mr-1.5 size-4" icon={icon} kind={kind} />
          <span className="min-w-0 truncate">
            {value.trim().length > 0 ? value : t('untitled')}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <DocumentStatus />
        {updatedAt ? (
          <span className="hidden shrink-0 px-1.5 text-caption text-content-subtle tablet:inline">
            {t('editedAt', { time: format.relativeTime(updatedAt, now) })}
          </span>
        ) : null}
        <PresenceIndicator />
        <CommentsPanel documentId={documentId} initialOpenCount={openComments} />
        <ShareButton canShare={isOwner} documentId={documentId} />
        <ButtonIcon
          aria-label={t('copyLink')}
          onClick={() => {
            void navigator.clipboard
              .writeText(window.location.href)
              .then(() => toast.success(t('linkCopied')))
          }}
          size="medium"
          variant="ghost"
        >
          <ClipboardContentIcon aria-hidden="true" />
        </ButtonIcon>
        <DocumentMenu
          canEdit={canEdit}
          canMoveToTeamspace={canMoveToTeamspace}
          documentId={documentId}
          isOwner={isOwner}
        />
      </div>
    </>
  )

  return (
    <>
      {slot ? createPortal(topbar, slot) : null}

      <div className={cn('px-4', wide ? 'tablet:px-24' : 'tablet:px-[54px]')}>
        {icon && !wide ? (
          <DocumentIcon
            className="mb-2 size-[78px] text-[70px]"
            icon={icon}
            kind={kind}
          />
        ) : null}

        <div className={wide ? 'flex items-center gap-1.5' : undefined}>
        {icon && wide ? (
          <DocumentIcon
            className="size-7 text-[26px]"
            icon={icon}
            kind={kind}
          />
        ) : null}
        {canEdit ? (
          <h1 className={wide ? 'flex min-w-0 flex-1 items-center' : undefined}>
            <label className="sr-only" htmlFor={titleId}>
              {t('titleLabel')}
            </label>
            <textarea
              className={cn(
                'block w-full resize-none overflow-hidden bg-transparent font-heavy text-content-strong outline-none placeholder:text-content-disabled disabled:opacity-60',
                wide
                  ? 'text-display-compact'
                  : 'text-display-small tablet:text-display-medium',
              )}
              disabled={saving}
              id={titleId}
              onBlur={persist}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                  requestEditorFocus()
                }

                if (event.key === 'Escape') {
                  setValue(lastSaved.current)
                  event.currentTarget.blur()
                }
              }}
              placeholder={t('untitled')}
              ref={fieldRef}
              rows={1}
              value={value}
            />
            <span aria-live="polite" className="sr-only">
              {saving ? t('savingTitle') : ''}
            </span>
          </h1>
        ) : (
          <h1
            className={cn(
              'font-heavy text-content-strong',
              wide
                ? 'text-display-compact'
                : 'text-display-small tablet:text-display-medium',
            )}
          >
            {title}
          </h1>
        )}
        </div>
      </div>
    </>
  )
}

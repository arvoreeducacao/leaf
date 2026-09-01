'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { DocumentMenu } from '@/components/app/document-menu'
import { DocumentStatus } from '@/components/app/document-status'
import { PresenceIndicator } from '@/components/app/presence-indicator'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { CommentsPanel } from '@/components/comments/comments-panel'
import {
  documentTitleInputId,
  requestEditorFocus,
} from '@/components/editor/focus-bridge'
import { CaretRightIcon, TeamIcon, UsersIcon } from '@/components/icons'
import { ShareButton } from '@/components/sharing/share-button'
import { Badge } from '@/components/ui/badge'
import { renameDocument } from '@/lib/document-actions'

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
}: Props) {
  const t = useTranslations('document')
  const tTeamspace = useTranslations('teamspace')
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
        {breadcrumb}
        {breadcrumb ? (
          <CaretRightIcon
            aria-hidden="true"
            className="size-3 shrink-0 text-content-disabled"
          />
        ) : null}
        <span className="min-w-0 truncate rounded-large px-1.5 py-0.5 text-content-strong">
          {value.trim().length > 0 ? value : t('untitled')}
        </span>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <DocumentStatus />
        <PresenceIndicator />
        <CommentsPanel documentId={documentId} initialOpenCount={openComments} />
        <ShareButton canShare={isOwner} documentId={documentId} />
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

      <div className="px-4 tablet:px-[54px]">
        {canEdit ? (
          <h1>
            <label className="sr-only" htmlFor={titleId}>
              {t('titleLabel')}
            </label>
            <textarea
              className="block w-full resize-none overflow-hidden bg-transparent font-heavy text-content-strong text-display-small outline-none tablet:text-display-medium placeholder:text-content-disabled disabled:opacity-60"
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
          <h1 className="font-heavy text-content-strong text-display-small tablet:text-display-medium">
            {title}
          </h1>
        )}

        {teamspaceName || sharedWithOrganization ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {teamspaceName ? (
              <Badge
                data-testid="document-teamspace-tag"
                title={tTeamspace('badgeHint')}
                variant="info"
              >
                <UsersIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="max-w-40 truncate">{teamspaceName}</span>
                <span className="sr-only">{tTeamspace('badgeHint')}</span>
              </Badge>
            ) : null}
            {sharedWithOrganization ? (
              <Badge
                data-testid="document-org-tag"
                title={t('orgTagHint')}
                variant="info"
              >
                <TeamIcon aria-hidden="true" className="size-3.5 shrink-0" />
                {t('orgTag')}
                <span className="sr-only">{t('orgTagHint')}</span>
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

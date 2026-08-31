'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { DocumentMenu } from '@/components/app/document-menu'
import { CommentsPanel } from '@/components/comments/comments-panel'
import {
  documentTitleInputId,
  requestEditorFocus,
} from '@/components/editor/focus-bridge'
import { TeamIcon, UsersIcon } from '@/components/icons'
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
}: Props) {
  const t = useTranslations('document')
  const tTeamspace = useTranslations('teamspace')
  const titleId = documentTitleInputId
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(title)
  const loadedFor = useRef(documentId)

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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1 basis-full tablet:basis-0">
        {canEdit ? (
          <h1 className="min-w-0">
            <label className="sr-only" htmlFor={titleId}>
              {t('titleLabel')}
            </label>
            <input
              className="w-full rounded-large border border-line bg-transparent px-2 py-1 font-bold text-display-small text-content-strong outline-none transition-colors hover:border-line-strong focus-visible:border-line-contrast focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
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
              value={value}
            />
            <span aria-live="polite" className="sr-only">
              {saving ? t('savingTitle') : ''}
            </span>
          </h1>
        ) : (
          <h1 className="px-2 py-1 font-bold text-display-small text-content-strong">
            {title}
          </h1>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {teamspaceName ? (
          <Badge
            className="gap-1"
            data-testid="document-teamspace-tag"
            title={tTeamspace('badgeHint')}
            variant="info"
          >
            <UsersIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="max-w-40 truncate">{teamspaceName}</span>
            <span className="sr-only">{tTeamspace('badgeHint')}</span>
          </Badge>
        ) : null}
        {sharedWithOrganization ? (
          <Badge
            className="gap-1"
            data-testid="document-org-tag"
            title={t('orgTagHint')}
            variant="info"
          >
            <TeamIcon aria-hidden="true" className="size-4 shrink-0" />
            {t('orgTag')}
            <span className="sr-only">{t('orgTagHint')}</span>
          </Badge>
        ) : null}
        <CommentsPanel documentId={documentId} initialOpenCount={openComments} />
        <ShareButton canShare={isOwner} documentId={documentId} />
        <DocumentMenu
          canEdit={canEdit}
          canMoveToTeamspace={canMoveToTeamspace}
          documentId={documentId}
          isOwner={isOwner}
        />
      </div>
    </div>
  )
}

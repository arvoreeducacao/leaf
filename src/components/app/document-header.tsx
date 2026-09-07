'use client'

import { useFormatter, useNow, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { AddCoverButton } from '@/components/app/add-cover-button'
import { DocumentIcon } from '@/components/app/document-icon'
import { DocumentMenu } from '@/components/app/document-menu'
import { DocumentStatus } from '@/components/app/document-status'
import { FavoriteButton } from '@/components/app/favorite-button'
import { IconPicker } from '@/components/app/icon-picker'
import { PresenceIndicator } from '@/components/app/presence-indicator'
import { useTopbarSlot } from '@/components/app/topbar-slot'
import { CommentsPanel } from '@/components/comments/comments-panel'
import {
  documentTitleInputId,
  requestEditorFocus,
} from '@/components/editor/focus-bridge'
import { CrumbSeparator, crumbClass } from '@/components/app/document-breadcrumb'
import { ClipboardContentIcon, HappyIcon } from '@/components/icons'
import { PeopleIcon } from '@/components/icons/outline'
import { ShareButton } from '@/components/sharing/share-button'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  removeDocumentIcon,
  renameDocument,
  setDocumentIcon,
} from '@/lib/document-actions'
import { readDocumentIcon } from '@/lib/document-icon'
import { cn } from '@/shared/utils'

const dayInMs = 24 * 60 * 60 * 1000

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
  kind?: 'page' | 'database' | 'row' | 'template'
  updatedAt?: Date | null
  hasCover?: boolean
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
  hasCover = false,
}: Props) {
  const t = useTranslations('document')
  const tTeamspace = useTranslations('teamspace')
  const tIcon = useTranslations('icon')
  const format = useFormatter()
  const now = useNow()
  const router = useRouter()
  const titleId = documentTitleInputId
  const slot = useTopbarSlot()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const lastSaved = useRef(title)
  const lastFromServer = useRef(title)
  const loadedFor = useRef(documentId)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const hasIcon = readDocumentIcon(icon) !== null
  const editedAt =
    updatedAt && updatedAt.getTime() > now.getTime() ? now : updatedAt
  const editedLabel = editedAt
    ? now.getTime() - editedAt.getTime() < dayInMs
      ? format.relativeTime(editedAt, now)
      : format.dateTime(editedAt, { day: 'numeric', month: 'short' })
    : null

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
    if (loadedFor.current === documentId && lastFromServer.current === title) {
      return
    }

    loadedFor.current = documentId
    lastFromServer.current = title
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

  const bigIcon = (
    <DocumentIcon className="size-[78px] text-[70px]" icon={icon} kind={kind} />
  )

  const inlineIcon = (
    <DocumentIcon className="size-7 text-[26px]" icon={icon} kind={kind} />
  )

  const topbar = (
    <>
      <div className="flex min-w-0 flex-1 items-center text-body-small text-content">
        {sharedWithOrganization && !teamspaceName ? (
          <>
            <span
              className={cn(crumbClass, 'hidden shrink desktop:inline-flex')}
              data-testid="document-org-tag"
              title={t('orgTagHint')}
            >
              <PeopleIcon aria-hidden="true" className="mr-1 size-4.5 shrink-0" />
              <span className="min-w-0 truncate">{t('orgTag')}</span>
            </span>
            <span className="hidden desktop:contents">
              <CrumbSeparator />
            </span>
          </>
        ) : null}
        {teamspaceName ? (
          <>
            <span
              className={cn(crumbClass, 'hidden shrink tablet:inline-flex')}
              data-testid="document-teamspace-tag"
              title={tTeamspace('badgeHint')}
            >
              <PeopleIcon aria-hidden="true" className="mr-1 size-4.5 shrink-0" />
              <span className="min-w-0 truncate">{teamspaceName}</span>
            </span>
            <span className="hidden tablet:contents">
              <CrumbSeparator />
            </span>
          </>
        ) : null}
        {breadcrumb}
        {breadcrumb ? <CrumbSeparator /> : null}
        <span className={cn(crumbClass, 'shrink-0 hover:bg-transparent')}>
          <DocumentIcon
            className="mr-1 size-4.5 text-[16px]"
            icon={icon}
            kind={kind}
          />
          <span className="min-w-0 truncate">
            {value.trim().length > 0 ? value : t('untitled')}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-0.5">
        <span className="hidden desktop:contents">
          <DocumentStatus />
        </span>
        {editedLabel ? (
          <span className="hidden shrink-0 px-2 text-body-small text-content-subtle desktop:inline">
            {t('editedAt', { time: editedLabel })}
          </span>
        ) : null}
        <PresenceIndicator />
        <ShareButton canShare={isOwner} documentId={documentId} />
        <ButtonIcon
          aria-label={t('copyLink')}
          className="[&_svg]:size-5"
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
        <CommentsPanel documentId={documentId} initialOpenCount={openComments} />
        <FavoriteButton documentId={documentId} />
        <DocumentMenu
          canEdit={canEdit}
          canMoveToTeamspace={canMoveToTeamspace}
          documentId={documentId}
          isOwner={isOwner}
          title={value}
        />
      </div>
    </>
  )

  return (
    <>
      {slot ? createPortal(topbar, slot) : null}

      <div
        className={cn(
          'group/header px-4',
          wide ? 'tablet:px-24' : 'tablet:px-[54px]',
        )}
      >
        {hasIcon && !wide ? (
          <div
            className={cn(
              'relative z-10 mb-2 w-fit',
              hasCover && '-mt-[63px] tablet:-mt-[79px]',
            )}
          >
            {canEdit ? (
              <button
                aria-label={tIcon('change')}
                className="-ml-1 flex cursor-pointer rounded-large p-1 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="document-icon-button"
                onClick={() => setIconPickerOpen(true)}
                type="button"
              >
                {bigIcon}
              </button>
            ) : (
              bigIcon
            )}
          </div>
        ) : null}

        {canEdit && (!hasIcon || !hasCover) ? (
          <div className="mb-1 flex gap-1 transition-opacity tablet:opacity-0 tablet:focus-within:opacity-100 tablet:group-hover/header:opacity-100">
            {hasIcon ? null : (
              <Button
                className="text-content-subtle"
                onClick={() => setIconPickerOpen(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <HappyIcon aria-hidden="true" />
                {tIcon('add')}
              </Button>
            )}
            {hasCover ? null : <AddCoverButton documentId={documentId} />}
          </div>
        ) : null}

        <div className={wide ? 'flex items-center gap-1.5' : undefined}>
        {hasIcon && wide ? (
          canEdit ? (
            <button
              aria-label={tIcon('change')}
              className="-ml-0.5 flex cursor-pointer rounded-medium p-0.5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="document-icon-button"
              onClick={() => setIconPickerOpen(true)}
              type="button"
            >
              {inlineIcon}
            </button>
          ) : (
            inlineIcon
          )
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

      {canEdit ? (
        <IconPicker
          currentIcon={icon ?? null}
          description={tIcon('pickerDescription')}
          onApplied={() => router.refresh()}
          onApply={(next) => setDocumentIcon(documentId, next)}
          onOpenChange={setIconPickerOpen}
          onRemove={() => removeDocumentIcon(documentId)}
          open={iconPickerOpen}
          removedMessage={tIcon('removed')}
          title={tIcon('pickerTitle')}
        />
      ) : null}
    </>
  )
}

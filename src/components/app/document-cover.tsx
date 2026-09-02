'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { CoverPicker } from '@/components/app/cover-picker'
import { setDocumentCoverPosition } from '@/lib/document-actions'
import {
  type CoverCredit,
  clampCoverPosition,
  gradientOfCover,
} from '@/lib/document-cover'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documentId: string
  cover: string
  position: number
  credit: CoverCredit | null
  canEdit: boolean
  unsplashEnabled: boolean
}>

const keyboardStep = 5

const controlClass =
  'inline-flex h-7 cursor-pointer items-center bg-surface-card/90 px-2 font-medium text-caption text-content backdrop-blur-sm transition-colors outline-none hover:bg-surface-card hover:text-content-strong focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

export function DocumentCover({
  documentId,
  cover,
  position,
  credit,
  canEdit,
  unsplashEnabled,
}: Props) {
  const t = useTranslations('cover')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [repositioning, setRepositioning] = useState(false)
  const [draft, setDraft] = useState(position)
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ startY: number; startPosition: number } | null>(null)
  const gradient = gradientOfCover(cover)
  const shown = repositioning ? draft : position

  useEffect(() => {
    setDraft(position)
    setRepositioning(false)
  }, [position, cover])

  function overflowHeight() {
    const frame = frameRef.current
    const image = imageRef.current

    if (!frame || !image || image.naturalWidth === 0) {
      return 0
    }

    const rendered = (frame.clientWidth * image.naturalHeight) / image.naturalWidth

    return Math.max(0, rendered - frame.clientHeight)
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!repositioning || event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startPosition: draft }
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const overflow = overflowHeight()

    if (!drag || overflow === 0) {
      return
    }

    const delta = ((event.clientY - drag.startY) / overflow) * 100

    setDraft(clampCoverPosition(drag.startPosition - delta))
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId)
      dragRef.current = null
    }
  }

  function nudge(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!repositioning) {
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      setDraft((current) =>
        clampCoverPosition(
          current + (event.key === 'ArrowUp' ? keyboardStep : -keyboardStep),
        ),
      )
    }

    if (event.key === 'Escape') {
      cancelReposition()
    }
  }

  function cancelReposition() {
    setDraft(position)
    setRepositioning(false)
  }

  function savePosition() {
    startTransition(async () => {
      const result = await setDocumentCoverPosition(documentId, draft)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      setRepositioning(false)
      router.refresh()
    })
  }

  return (
    <div
      aria-busy={pending}
      aria-label={t('region')}
      className="group/cover relative h-[30vh] max-h-70 min-h-40 w-full select-none overflow-hidden bg-surface-subtle"
      data-cover={cover}
      data-testid="document-cover"
      role="region"
    >
      <div
        aria-label={repositioning ? t('repositionLabel') : undefined}
        aria-valuemax={repositioning ? 100 : undefined}
        aria-valuemin={repositioning ? 0 : undefined}
        aria-valuenow={repositioning ? draft : undefined}
        className={cn(
          'absolute inset-0 outline-none',
          repositioning && 'cursor-move touch-none',
        )}
        onKeyDown={nudge}
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        ref={frameRef}
        role={repositioning ? 'slider' : undefined}
        tabIndex={repositioning ? 0 : undefined}
      >
        {gradient ? (
          <div
            aria-hidden="true"
            className="size-full"
            style={{ background: gradient.css }}
          />
        ) : (
          <img
            alt={t('imageAlt')}
            className="size-full object-cover"
            draggable={false}
            ref={imageRef}
            src={cover}
            style={{ objectPosition: `center ${shown}%` }}
          />
        )}
      </div>

      {repositioning ? (
        <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-large bg-surface-card/90 px-2 py-1 text-caption text-content backdrop-blur-sm">
          {t('repositionHint')}
        </p>
      ) : null}

      {credit && !repositioning ? (
        <a
          className="absolute bottom-3 left-4 rounded-large bg-surface-card/90 px-2 py-1 text-caption text-content backdrop-blur-sm transition-opacity hover:text-content-strong tablet:opacity-0 tablet:group-hover/cover:opacity-100 tablet:focus-visible:opacity-100"
          href={credit.url}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {t('creditLabel', { name: credit.name })}
        </a>
      ) : null}

      {canEdit ? (
        <div
          className={cn(
            'absolute right-4 bottom-3 flex overflow-hidden rounded-large border border-line-soft shadow-center-small transition-opacity',
            !repositioning &&
              'tablet:opacity-0 tablet:group-hover/cover:opacity-100 tablet:focus-within:opacity-100',
          )}
        >
          {repositioning ? (
            <>
              <button
                className={controlClass}
                disabled={pending}
                onClick={savePosition}
                type="button"
              >
                {t('savePosition')}
              </button>
              <button
                className={cn(controlClass, 'border-line-soft border-l')}
                disabled={pending}
                onClick={cancelReposition}
                type="button"
              >
                {tCommon('cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                className={controlClass}
                disabled={pending}
                onClick={() => setPickerOpen(true)}
                type="button"
              >
                {t('change')}
              </button>
              {gradient ? null : (
                <button
                  className={cn(controlClass, 'border-line-soft border-l')}
                  disabled={pending}
                  onClick={() => {
                    setDraft(position)
                    setRepositioning(true)
                  }}
                  type="button"
                >
                  {t('reposition')}
                </button>
              )}
            </>
          )}
        </div>
      ) : null}

      {canEdit ? (
        <CoverPicker
          currentCover={cover}
          documentId={documentId}
          onApplied={() => router.refresh()}
          onOpenChange={setPickerOpen}
          open={pickerOpen}
          unsplashEnabled={unsplashEnabled}
        />
      ) : null}
    </div>
  )
}

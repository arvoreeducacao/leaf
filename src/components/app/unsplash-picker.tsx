'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { SearchIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type UnsplashPhoto, unsplashHomeUrl } from '@/lib/unsplash'

type Props = Readonly<{
  enabled: boolean
  disabled: boolean
  onPick: (photo: UnsplashPhoto) => void
}>

type Status = 'loading' | 'done' | 'error'

type SearchResponse = {
  photos?: Array<UnsplashPhoto>
  totalPages?: number
  error?: string
}

const debounceMs = 400

function messageOf(cause: unknown) {
  return cause instanceof Error && cause.message.length > 0
    ? cause.message
    : null
}

async function fetchPhotos(
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<{ photos: Array<UnsplashPhoto>; totalPages: number }> {
  const params = new URLSearchParams({ query, page: String(page) })
  const response = await fetch(`/api/unsplash?${params.toString()}`, {
    signal,
  })
  const data = (await response.json().catch(() => ({}))) as SearchResponse

  if (!response.ok) {
    throw new Error(data.error)
  }

  return {
    photos: Array.isArray(data.photos) ? data.photos : [],
    totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
  }
}

export function UnsplashPicker({ enabled, disabled, onPick }: Props) {
  const t = useTranslations('cover')
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [photos, setPhotos] = useState<Array<UnsplashPhoto>>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      debounceMs,
    )

    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!enabled) {
      return
    }

    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setStatus('loading')
    setError(null)
    setPage(1)

    fetchPhotos(debouncedQuery, 1, controller.signal)
      .then((result) => {
        setPhotos(result.photos)
        setTotalPages(result.totalPages)
        setStatus('done')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setError(messageOf(cause))
        setStatus('error')
      })

    return () => controller.abort()
  }, [debouncedQuery, enabled])

  function loadMore() {
    const next = page + 1
    const controller = new AbortController()

    setStatus('loading')

    fetchPhotos(debouncedQuery, next, controller.signal)
      .then((result) => {
        setPhotos((current) => [...current, ...result.photos])
        setTotalPages(result.totalPages)
        setPage(next)
        setStatus('done')
      })
      .catch((cause: unknown) => {
        setError(messageOf(cause))
        setStatus('error')
      })
  }

  if (!enabled) {
    return (
      <p className="rounded-large bg-surface-subtle px-3 py-2 text-body-small text-content">
        {t('unsplashNotConfigured')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label className="sr-only" htmlFor={inputId}>
          {t('unsplashSearchLabel')}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-content-subtle"
        />
        <Input
          autoComplete="off"
          className="max-w-none pl-8"
          id={inputId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('unsplashSearchPlaceholder')}
          type="search"
          value={query}
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {status === 'loading' ? t('unsplashLoading') : ''}
      </div>

      {status === 'error' ? (
        <p className="text-body-small text-danger" role="alert">
          {error ?? t('unsplashFailed')}
        </p>
      ) : null}

      {status === 'done' && photos.length === 0 ? (
        <p className="py-6 text-center text-body-small text-content-subtle">
          {t('unsplashEmpty', { query: debouncedQuery })}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-2 tablet:grid-cols-3">
        {photos.map((photo) => (
          <li className="flex min-w-0 flex-col gap-0.5" key={photo.id}>
            <button
              aria-label={
                photo.alt.length > 0
                  ? `${photo.alt} · ${t('unsplashPhotoBy', { name: photo.credit.name })}`
                  : t('unsplashPhotoBy', { name: photo.credit.name })
              }
              className="aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-large bg-surface-subtle outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              onClick={() => onPick(photo)}
              style={photo.color ? { backgroundColor: photo.color } : undefined}
              type="button"
            >
              <img
                alt=""
                className="size-full object-cover"
                loading="lazy"
                src={photo.thumbUrl}
              />
            </button>
            <a
              className="truncate text-caption text-content-subtle hover:text-content-strong hover:underline"
              href={photo.credit.url}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {photo.credit.name}
            </a>
          </li>
        ))}
      </ul>

      {status === 'loading' && photos.length === 0 ? (
        <ul aria-hidden="true" className="grid grid-cols-2 gap-2 tablet:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <li
              className="aspect-[3/2] animate-pulse rounded-large bg-surface-subtle"
              key={index}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-content-subtle">
          {t('unsplashFooter')}{' '}
          <a
            className="underline underline-offset-2 hover:text-content-strong"
            href={unsplashHomeUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Unsplash
          </a>
        </p>
        {page < totalPages && photos.length > 0 ? (
          <Button
            disabled={status === 'loading' || disabled}
            onClick={loadMore}
            size="sm"
            type="button"
            variant="outline"
          >
            {t('unsplashLoadMore')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

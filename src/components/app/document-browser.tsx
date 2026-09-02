'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { DocumentIcon } from '@/components/app/document-icon'
import { Input } from '@/components/ui/input'
import { normalizeTitle } from '@/lib/document-title'
import type { BrowsableDocument } from '@/lib/documents'

const rowHeight = 40
const overscan = 8

type Props = Readonly<{
  documents: Array<BrowsableDocument>
  title: string
}>

export function DocumentBrowser({ documents, title }: Props) {
  const t = useTranslations('nav')
  const filterId = useId()
  const [query, setQuery] = useState('')
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const scrollerRef = useRef<HTMLDivElement>(null)
  const deferredQuery = useDeferredValue(query)

  const searchable = useMemo(
    () =>
      documents.map((document) => ({
        document,
        haystack: normalizeTitle(document.title),
      })),
    [documents],
  )

  const filtered = useMemo(() => {
    const term = normalizeTitle(deferredQuery)

    if (term.length === 0) {
      return documents
    }

    return searchable
      .filter((entry) => entry.haystack.includes(term))
      .map((entry) => entry.document)
  }, [deferredQuery, documents, searchable])

  useEffect(() => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    function measure() {
      const node = scrollerRef.current

      if (!node) {
        return
      }

      setViewport({ top: node.scrollTop, height: node.clientHeight })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    scroller.addEventListener('scroll', measure, { passive: true })

    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', measure)
    }
  }, [])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 })
  }, [deferredQuery])

  const first = Math.max(0, Math.floor(viewport.top / rowHeight) - overscan)
  const visibleCount = Math.ceil(viewport.height / rowHeight) + overscan * 2
  const last = Math.min(filtered.length, first + visibleCount)
  const visibleRows = filtered.slice(first, last)

  return (
    <div className="flex h-[calc(100dvh-3rem)] w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-medium text-content-strong text-heading-small">
          {title}
        </h1>
        <p className="text-body-small text-content-subtle">
          {t('showingCount', { count: filtered.length })}
        </p>
      </div>

      <label className="sr-only" htmlFor={filterId}>
        {t('filterLabel')}
      </label>
      <Input
        className="max-w-full"
        id={filterId}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('filterPlaceholder')}
        type="search"
        value={query}
      />

      {filtered.length === 0 ? (
        <p className="text-body-small text-content-disabled">
          {t('filterEmpty')}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollerRef}>
          <ul
            className="relative w-full"
            style={{ height: filtered.length * rowHeight }}
          >
            {visibleRows.map((document, index) => (
              <li
                className="absolute right-0 left-0"
                key={document.id}
                style={{ top: (first + index) * rowHeight, height: rowHeight }}
              >
                <Link
                  className="flex h-full w-full min-w-0 items-center gap-2 rounded-large px-2 text-body-small text-content transition-colors hover:bg-surface-hover hover:text-content-strong focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1"
                  href={`/doc/${document.id}`}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <DocumentIcon
                      className="size-4 shrink-0 text-content-subtle"
                      icon={document.icon}
                      kind={document.kind === 'row' ? 'page' : document.kind}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {document.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

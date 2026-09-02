'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { BackIcon, MagicWandIcon, PageIcon } from '@/components/icons'
import { answerSegments } from '@/lib/ai-ask'

type AskSourceLink = Readonly<{ id: string; title: string }>

type AskStatus = 'thinking' | 'writing' | 'done' | 'empty' | 'error'

type Props = Readonly<{
  question: string
  onOpenDocument: (documentId: string) => void
  onBack: () => void
}>

const sourcesHeader = 'x-leaf-sources'

function readSources(header: string | null): Array<AskSourceLink> {
  if (!header) {
    return []
  }

  try {
    const bytes = Uint8Array.from(atob(header), (character) =>
      character.charCodeAt(0),
    )
    const decoded = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as Array<AskSourceLink>

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}

export function PaletteAsk({ question, onOpenDocument, onBack }: Props) {
  const t = useTranslations('palette')
  const [status, setStatus] = useState<AskStatus>('thinking')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Array<AskSourceLink>>([])
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    backRef.current?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    setStatus('thinking')
    setAnswer('')
    setSources([])

    async function ask() {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        setStatus('error')

        return
      }

      const found = readSources(response.headers.get(sourcesHeader))

      setSources(found)

      if (found.length === 0) {
        setStatus('empty')

        return
      }

      setStatus('writing')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        setAnswer((current) => current + decoder.decode(value, { stream: true }))
      }

      setStatus('done')
    }

    ask().catch(() => {
      if (!controller.signal.aborted) {
        setStatus('error')
      }
    })

    return () => controller.abort()
  }, [question])

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-line-divider border-b px-3 py-2.5">
        <button
          aria-label={t('askBack')}
          className="flex size-6 shrink-0 items-center justify-center rounded-medium text-content-subtle transition-colors hover:bg-surface-hover"
          onClick={onBack}
          ref={backRef}
          type="button"
        >
          <BackIcon aria-hidden="true" className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-body-small text-content-strong">
          {question}
        </p>
        <MagicWandIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-content-subtle"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p
          aria-busy={status === 'thinking' || status === 'writing'}
          aria-label={t('askAnswerLabel')}
          aria-live="polite"
          className="whitespace-pre-wrap text-body-small text-content-strong"
        >
          {status === 'thinking' ? (
            <span className="text-content-subtle">{t('askThinking')}</span>
          ) : null}
          {status === 'empty' ? (
            <span className="text-content-subtle">{t('askEmpty')}</span>
          ) : null}
          {status === 'error' ? (
            <span className="text-content-subtle">{t('askError')}</span>
          ) : null}
          {answerSegments(answer).map((segment, position) =>
            segment.strong ? (
              <strong className="font-semibold" key={position}>
                {segment.text}
              </strong>
            ) : (
              <span key={position}>{segment.text}</span>
            ),
          )}
        </p>

        {sources.length > 0 ? (
          <div className="mt-4">
            <p className="pb-1 font-medium text-caption text-content-subtle">
              {t('askSources')}
            </p>
            <ul>
              {sources.map((source, index) => (
                <li key={source.id}>
                  <button
                    className="flex w-full min-h-11 cursor-pointer items-center gap-2 rounded-medium px-2 py-1 text-left transition-colors hover:bg-surface-hover tablet:min-h-8"
                    onClick={() => onOpenDocument(source.id)}
                    type="button"
                  >
                    <span className="w-4 shrink-0 text-caption text-content-subtle">
                      {index + 1}
                    </span>
                    <PageIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-content-subtle"
                    />
                    <span className="min-w-0 flex-1 truncate text-body-small text-content-strong">
                      {source.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

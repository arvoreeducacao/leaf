'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AiFace } from '@/components/ai/ai-face'
import { ArrowUpIcon, CancelIcon, PageIcon } from '@/components/icons'
import { PlusIcon } from '@/components/icons/outline'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { answerSegments, askQuestionMinLength } from '@/lib/ai-ask'
import type { AskStatus, FaceState } from '@/lib/ai-face-state'
import { faceHoldMs, faceStateFor } from '@/lib/ai-face-state'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

const sourcesHeader = 'x-leaf-sources'
const typingIdleMs = 900

type SourceLink = Readonly<{ id: string; title: string }>

type Turn = {
  id: number
  question: string
  answer: string
  sources: Array<SourceLink>
  status: AskStatus
}

function readSources(header: string | null): Array<SourceLink> {
  if (!header) {
    return []
  }

  try {
    const bytes = Uint8Array.from(atob(header), (character) =>
      character.charCodeAt(0),
    )
    const decoded = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as Array<SourceLink>

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}

export function AiAssistant() {
  const t = useTranslations('ai')
  const router = useRouter()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [typing, setTyping] = useState(false)
  const [turns, setTurns] = useState<Array<Turn>>([])
  const [poked, setPoked] = useState(false)
  const [relaxed, setRelaxed] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const last = turns.at(-1)
  const status: AskStatus = last ? last.status : 'idle'
  const busy = status === 'thinking' || status === 'writing'
  const state: FaceState = poked
    ? 'poked'
    : faceStateFor({ open, typing, status: relaxed ? 'idle' : status })

  useEffect(() => {
    if (!typing) {
      return
    }

    const timer = window.setTimeout(() => setTyping(false), typingIdleMs)

    return () => window.clearTimeout(timer)
  }, [typing, question])

  useEffect(() => {
    setRelaxed(false)

    const hold = faceHoldMs(faceStateFor({ open, typing: false, status }))

    if (hold === null) {
      return
    }

    const timer = window.setTimeout(() => setRelaxed(true), hold)

    return () => window.clearTimeout(timer)
  }, [open, status])

  useEffect(() => {
    if (!poked) {
      return
    }

    const hold = faceHoldMs('poked') ?? 0
    const timer = window.setTimeout(() => setPoked(false), hold)

    return () => window.clearTimeout(timer)
  }, [poked])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [turns])

  useEffect(() => () => streamRef.current?.abort(), [])

  const ask = useCallback(async (asked: string) => {
    const id = Date.now()

    streamRef.current?.abort()

    const controller = new AbortController()

    streamRef.current = controller

    setTurns((current) => [
      ...current,
      { id, question: asked, answer: '', sources: [], status: 'thinking' },
    ])

    function patch(change: Partial<Turn>) {
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)),
      )
    }

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: asked }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        patch({ status: 'error' })

        return
      }

      const found = readSources(response.headers.get(sourcesHeader))

      if (found.length === 0) {
        patch({ status: 'empty' })

        return
      }

      patch({ sources: found, status: 'writing' })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })

        setTurns((current) =>
          current.map((turn) =>
            turn.id === id ? { ...turn, answer: turn.answer + chunk } : turn,
          ),
        )
      }

      patch({ status: 'done' })
    } catch {
      if (!controller.signal.aborted) {
        patch({ status: 'error' })
      }
    }
  }, [])

  const submit = useCallback(() => {
    const asked = question.trim()

    if (asked.length < askQuestionMinLength || busy) {
      return
    }

    setQuestion('')
    setTyping(false)
    void ask(asked)
  }, [ask, busy, question])

  function openDocument(id: string) {
    setOpen(false)
    router.push(`/doc/${id}`)
  }

  function startOver() {
    streamRef.current?.abort()
    setTurns([])
    setQuestion('')
    inputRef.current?.focus()
  }

  function fillStarter(starter: string) {
    setQuestion(starter)
    setTyping(true)
    inputRef.current?.focus()
  }

  const starters = [t('starterHow'), t('starterWho'), t('starterWhere')]

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-card text-content-strong">
          <AiFace size={18} state={state} />
        </span>
        <p className="min-w-0 flex-1 truncate text-body-small text-content-strong">
          {t('panelTitle')}
        </p>
        {turns.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <ButtonIcon
                aria-label={t('newChat')}
                onClick={startOver}
                size="medium"
                variant="ghost"
              >
                <PlusIcon aria-hidden="true" />
              </ButtonIcon>
            </TooltipTrigger>
            <TooltipContent>{t('newChat')}</TooltipContent>
          </Tooltip>
        ) : null}
        <ButtonIcon
          aria-label={t('close')}
          onClick={() => setOpen(false)}
          size="medium"
          variant="ghost"
        >
          <CancelIcon aria-hidden="true" />
        </ButtonIcon>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 pb-2">
        {turns.length === 0 ? (
          <div className="pb-2">
            <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-line bg-surface-card text-content-strong">
              <AiFace follow={true} size={26} state={state} />
            </span>
            <p className="pb-1 font-semibold text-body-medium text-content-strong">
              {t('greeting')}
            </p>
            <p className="pb-4 text-body-small text-content">{t('intro')}</p>
            <ul>
              {starters.map((starter) => (
                <li key={starter}>
                  <button
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-medium px-2 py-1 text-left text-body-small text-content-strong transition-colors hover:bg-surface-hover tablet:min-h-9"
                    onClick={() => fillStarter(starter)}
                    type="button"
                  >
                    <span className="text-content-subtle">{starter}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div className="pt-3" key={turn.id}>
            <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-medium bg-surface-subtle px-3 py-2 text-body-small text-content-strong">
              {turn.question}
            </p>
            <div className="flex gap-2">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface-card text-content-strong">
                <AiFace
                  size={18}
                  state={turn.id === last?.id ? state : 'resting'}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  aria-busy={
                    turn.status === 'thinking' || turn.status === 'writing'
                  }
                  aria-live={turn.id === last?.id ? 'polite' : 'off'}
                  className="whitespace-pre-wrap text-body-small text-content-strong"
                >
                  {turn.status === 'thinking' ? (
                    <span className="text-content-subtle">{t('thinking')}</span>
                  ) : null}
                  {turn.status === 'empty' ? (
                    <span className="text-content-subtle">{t('empty')}</span>
                  ) : null}
                  {turn.status === 'error' ? (
                    <span className="text-content-subtle">{t('error')}</span>
                  ) : null}
                  {answerSegments(turn.answer).map((segment, position) =>
                    segment.strong ? (
                      <strong className="font-semibold" key={position}>
                        {segment.text}
                      </strong>
                    ) : (
                      <span key={position}>{segment.text}</span>
                    ),
                  )}
                </p>

                {turn.sources.length > 0 ? (
                  <div className="mt-3">
                    <p className="pb-1 font-medium text-caption text-content-subtle">
                      {t('sources')}
                    </p>
                    <ul>
                      {turn.sources.map((source, index) => (
                        <li key={source.id}>
                          <button
                            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-medium px-2 py-1 text-left transition-colors hover:bg-surface-hover tablet:min-h-8"
                            onClick={() => openDocument(source.id)}
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
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3">
        <div className="rounded-large border border-line-muted bg-surface-app px-3 py-2.5 transition-colors focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/30">
          <textarea
            aria-label={t('placeholder')}
            className="max-h-32 w-full resize-none bg-transparent text-body-small text-content-strong outline-none placeholder:text-content-disabled"
            onChange={(event) => {
              setQuestion(event.target.value)
              setTyping(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={t('placeholder')}
            ref={inputRef}
            rows={1}
            value={question}
          />
          <div className="flex items-center gap-2 pt-2">
            <p className="min-w-0 flex-1 truncate text-caption text-content-subtle">
              {t('scope')}
            </p>
            <ButtonIcon
              aria-label={t('send')}
              disabled={question.trim().length < askQuestionMinLength || busy}
              onClick={submit}
              size="medium"
              variant="ghost"
            >
              <ArrowUpIcon aria-hidden="true" />
            </ButtonIcon>
          </div>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {open ? null : (
          <button
            aria-label={t('orbLabel')}
            className="fixed right-4 bottom-4 z-30 flex size-13 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-card text-content-strong shadow-down-medium transition-transform hover:scale-105"
            onClick={() => setOpen(true)}
            onPointerDown={() => setPoked(true)}
            type="button"
          >
            <AiFace size={34} state={state} />
          </button>
        )}
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetContent
            className="h-[86dvh] bg-surface-nav p-0"
            side="bottom"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t('panelTitle')}</SheetTitle>
              <SheetDescription>{t('intro')}</SheetDescription>
            </SheetHeader>
            {conversation}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <>
      {open ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t('orbLabel')}
              className="fixed right-6 bottom-6 z-30 flex size-13 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-card text-content-strong shadow-down-medium transition-transform hover:scale-105"
              onClick={() => setOpen(true)}
              onPointerDown={() => setPoked(true)}
              type="button"
            >
              <AiFace follow={true} size={34} state={state} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('orbLabel')}</TooltipContent>
        </Tooltip>
      )}
      <aside
        aria-hidden={!open || undefined}
        aria-label={t('panelTitle')}
        className={cn(
          'relative hidden shrink-0 border-line border-l bg-surface-nav transition-[width] duration-200 motion-reduce:transition-none tablet:block',
          open ? 'w-[380px]' : 'w-0 border-l-0',
        )}
        inert={!open}
      >
        <div className="sticky top-0 h-dvh overflow-hidden">
          <div className="flex h-full w-[380px] flex-col">
            {open ? conversation : null}
          </div>
        </div>
      </aside>
    </>
  )
}

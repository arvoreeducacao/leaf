'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { toast } from 'sonner'

import { CommentThreadItem } from '@/components/comments/comment-thread-item'
import {
  focusCommentedBlock,
  useBlockIndex,
} from '@/components/comments/comments-bridge'
import {
  ensureCommentsLoaded,
  publishCommentsState,
  useCommentsState,
} from '@/components/comments/comments-store'
import { layoutMarkers } from '@/components/comments/marker-layout'
import { ChatIcon } from '@/components/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  addComment,
  editComment,
  removeComment,
  resolveComment,
} from '@/lib/comment-actions'
import type { CommentsResult } from '@/lib/comment-actions'
import type { CommentThread } from '@/lib/comments'

type Props = Readonly<{
  documentId: string
  initialOpenCount: number
  containerRef: RefObject<HTMLDivElement | null>
}>

function sameTops(
  current: ReadonlyMap<string, number>,
  next: ReadonlyMap<string, number>,
) {
  if (current.size !== next.size) {
    return false
  }

  for (const [blockId, top] of next) {
    if (current.get(blockId) !== top) {
      return false
    }
  }

  return true
}

export function InlineComments({
  documentId,
  initialOpenCount,
  containerRef,
}: Props) {
  const t = useTranslations('comments')
  const format = useFormatter()
  const state = useCommentsState(documentId)
  const blockIndex = useBlockIndex()

  const [tops, setTops] = useState<ReadonlyMap<string, number>>(new Map())
  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (initialOpenCount > 0) {
      void ensureCommentsLoaded(documentId)
    }
  }, [documentId, initialOpenCount])

  const threadsByBlock = new Map<string, CommentThread[]>()

  for (const thread of state?.threads ?? []) {
    if (thread.blockId === null || thread.resolvedAt !== null) {
      continue
    }

    const group = threadsByBlock.get(thread.blockId) ?? []

    group.push(thread)
    threadsByBlock.set(thread.blockId, group)
  }

  const blockKey = [...threadsByBlock.keys()].sort().join(',')

  const measure = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const containerTop = container.getBoundingClientRect().top
    const next = new Map<string, number>()

    for (const blockId of blockKey.split(',')) {
      if (blockId.length === 0) {
        continue
      }

      const block = container.querySelector(
        `.bn-block-outer[data-id="${CSS.escape(blockId)}"]`,
      )

      if (block) {
        next.set(blockId, block.getBoundingClientRect().top - containerTop)
      }
    }

    setTops((current) => (sameTops(current, next) ? current : next))
  }, [containerRef, blockKey])

  useEffect(() => {
    measure()
  }, [measure, state, blockIndex])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let frame = 0

    function schedule() {
      if (frame !== 0) {
        return
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    const observer = new ResizeObserver(schedule)

    observer.observe(container)
    window.addEventListener('resize', schedule)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)

      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [containerRef, measure])

  async function run(
    action: () => Promise<CommentsResult>,
    success: string,
  ): Promise<boolean> {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return false
    }

    publishCommentsState(documentId, result.state)
    toast.success(success)

    return true
  }

  if (!state || threadsByBlock.size === 0) {
    return null
  }

  const markers = layoutMarkers(
    [...threadsByBlock.keys()]
      .filter((blockId) => tops.has(blockId))
      .map((blockId) => ({ blockId, top: tops.get(blockId) as number })),
  )

  const formatWhen = (at: number) => format.relativeTime(new Date(at), now)
  const formatExact = (at: number) =>
    format.dateTime(new Date(at), { dateStyle: 'long', timeStyle: 'short' })

  return (
    <div className="pointer-events-none absolute inset-y-0 right-1 hidden w-11 tablet:right-2 tablet:block">
      {markers.map(({ blockId, top }) => {
        const threads = threadsByBlock.get(blockId) ?? []
        const count = threads.reduce(
          (total, thread) => total + 1 + thread.replies.length,
          0,
        )

        return (
          <Popover
            key={blockId}
            onOpenChange={(open) => {
              if (open) {
                setNow(Date.now())
              }

              setOpenBlock(open ? blockId : null)
            }}
            open={openBlock === blockId}
          >
            <PopoverTrigger asChild>
              <button
                aria-label={t('markerLabel', { count })}
                className="pointer-events-auto absolute right-0 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-line bg-surface-card px-2 text-body-small text-content shadow-down-small transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card focus-visible:outline-none"
                data-block-id={blockId}
                data-testid="inline-comment-marker"
                style={{ top }}
                type="button"
              >
                <ChatIcon aria-hidden="true" className="size-3.5 shrink-0" />
                {count > 1 ? <span aria-hidden="true">{count}</span> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              aria-label={t('inlineTitle')}
              className="w-88 max-w-[calc(100vw-2rem)] p-0"
              data-testid="inline-comments-popover"
              side="bottom"
            >
              <ul
                aria-label={t('threadListLabel')}
                className="flex max-h-96 flex-col gap-3 overflow-y-auto p-3"
              >
                {threads.map((thread) => (
                  <CommentThreadItem
                    anchorMissing={false}
                    canComment={state.canComment}
                    canResolveAny={state.canResolveAny}
                    formatExact={formatExact}
                    formatWhen={formatWhen}
                    key={thread.id}
                    onDelete={async (commentId) => {
                      await run(
                        () => removeComment(documentId, commentId),
                        t('removed'),
                      )
                    }}
                    onEdit={(commentId, value) =>
                      run(
                        () => editComment(documentId, commentId, value),
                        t('updated'),
                      )
                    }
                    onGoToBlock={(target) => {
                      setOpenBlock(null)
                      focusCommentedBlock(target)
                    }}
                    onReply={(threadId, value) =>
                      run(
                        () => addComment(documentId, value, null, threadId),
                        t('added'),
                      )
                    }
                    onResolve={async (threadId, resolved) => {
                      await run(
                        () => resolveComment(documentId, threadId, resolved),
                        resolved ? t('resolvedToast') : t('reopenedToast'),
                      )
                    }}
                    pending={pending}
                    thread={thread}
                    viewerId={state.viewerId}
                  />
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}

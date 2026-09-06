'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { toast } from 'sonner'

import type { CommentViewer } from '@/components/comments/comment-composer'
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
import { MarginCommentCard } from '@/components/comments/margin-comment-card'
import {
  CARD_ANCHOR_OFFSET,
  fitLane,
  stackCards,
} from '@/components/comments/margin-layout'
import type { LaneFit } from '@/components/comments/margin-layout'
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
  viewer: CommentViewer
  containerRef: RefObject<HTMLDivElement | null>
}>

const blockIdPattern = /^[A-Za-z0-9_-]+$/

function sameNumbers(
  current: ReadonlyMap<string, number>,
  next: ReadonlyMap<string, number>,
) {
  if (current.size !== next.size) {
    return false
  }

  for (const [key, value] of next) {
    if (current.get(key) !== value) {
      return false
    }
  }

  return true
}

function anchorRule(
  blockIds: ReadonlyArray<string>,
  activeBlockId: string | null,
) {
  const blocks = blockIds
    .filter((blockId) => blockIdPattern.test(blockId))
    .map((blockId) => `.bn-block-outer[data-id="${blockId}"]`)

  if (blocks.length === 0) {
    return ''
  }

  const scope = `.leaf-editor :is(${blocks.join(',')})`
  const flat = `${scope} .bn-block-content:is([data-content-type="paragraph"],[data-content-type="heading"]){display:block;}`
  const mark = `${scope} .bn-inline-content{display:inline;-webkit-box-decoration-break:clone;box-decoration-break:clone;background-color:var(--comment-anchor);box-shadow:inset 0 -2px 0 var(--comment-anchor-line);}`

  if (activeBlockId === null || !blockIdPattern.test(activeBlockId)) {
    return `${flat}${mark}`
  }

  const active = `.leaf-editor .bn-block-outer[data-id="${activeBlockId}"] .bn-inline-content{background-color:var(--comment-anchor-active);box-shadow:inset 0 -2px 0 var(--comment-anchor-line-active);}`

  return `${flat}${mark}${active}`
}

export function InlineComments({
  documentId,
  initialOpenCount,
  viewer,
  containerRef,
}: Props) {
  const t = useTranslations('comments')
  const format = useFormatter()
  const state = useCommentsState(documentId)
  const blockIndex = useBlockIndex()

  const cardNodes = useRef(new Map<string, HTMLDivElement>())

  const [tops, setTops] = useState<ReadonlyMap<string, number>>(new Map())
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map())
  const [lane, setLane] = useState<LaneFit | null>(null)
  const [openBlock, setOpenBlock] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (initialOpenCount > 0) {
      void ensureCommentsLoaded(documentId)
    }
  }, [documentId, initialOpenCount])

  const anchored: ReadonlyArray<CommentThread> = (state?.threads ?? []).filter(
    (thread) => thread.blockId !== null && thread.resolvedAt === null,
  )

  const blockKey = [...new Set(anchored.map((thread) => thread.blockId))]
    .sort()
    .join(',')

  const measure = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const box = container.getBoundingClientRect()
    const next = new Map<string, number>()

    for (const blockId of blockKey.split(',')) {
      if (blockId.length === 0) {
        continue
      }

      const block = container.querySelector(
        `.bn-block-outer[data-id="${CSS.escape(blockId)}"]`,
      )

      if (block) {
        next.set(blockId, block.getBoundingClientRect().top - box.top)
      }
    }

    setTops((current) => (sameNumbers(current, next) ? current : next))

    const column = container.querySelector('.bn-block-outer') ?? container
    const fit = fitLane(
      column.getBoundingClientRect().right,
      document.documentElement.clientWidth,
    )

    setLane((current) => {
      if (fit === null) {
        return null
      }

      const left = Math.round(fit.left - box.left)

      if (current && current.left === left && current.width === fit.width) {
        return current
      }

      return { left, width: fit.width }
    })
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

  useLayoutEffect(() => {
    const next = new Map<string, number>()

    for (const [threadId, node] of cardNodes.current) {
      next.set(threadId, node.offsetHeight)
    }

    setHeights((current) => (sameNumbers(current, next) ? current : next))
  })

  useEffect(() => {
    if (lane === null) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('[data-testid="margin-comment-card"]')) {
        return
      }

      const block = target.closest('.bn-block-outer[data-id]')
      const blockId = block?.getAttribute('data-id') ?? null
      const thread = anchored.find((item) => item.blockId === blockId)

      setActiveThread(thread ? thread.id : null)
    }

    document.addEventListener('mousedown', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [anchored, lane])

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

    setNow(Date.now())
    publishCommentsState(documentId, result.state)
    toast.success(success)

    return true
  }

  if (!state) {
    return null
  }

  const placed = anchored.filter(
    (thread) => thread.blockId !== null && tops.has(thread.blockId),
  )

  if (placed.length === 0) {
    return null
  }

  const formatWhen = (at: number) => format.relativeTime(new Date(at), now)
  const formatExact = (at: number) =>
    format.dateTime(new Date(at), { dateStyle: 'long', timeStyle: 'short' })

  const handlers = {
    onDelete: async (commentId: string) => {
      await run(() => removeComment(documentId, commentId), t('removed'))
    },
    onEdit: (commentId: string, value: string) =>
      run(() => editComment(documentId, commentId, value), t('updated')),
    onReply: (threadId: string, value: string) =>
      run(() => addComment(documentId, value, null, threadId), t('added')),
    onResolve: async (threadId: string, resolved: boolean) => {
      await run(
        () => resolveComment(documentId, threadId, resolved),
        resolved ? t('resolvedToast') : t('reopenedToast'),
      )
    },
  }

  const anchorStyle = anchorRule(
    [...new Set(placed.map((thread) => thread.blockId as string))],
    placed.find((thread) => thread.id === activeThread)?.blockId ?? null,
  )

  if (lane !== null) {
    const stacked = new Map(
      stackCards(
        placed.map((thread) => ({
          id: thread.id,
          top:
            (tops.get(thread.blockId as string) as number) - CARD_ANCHOR_OFFSET,
          height: heights.get(thread.id) ?? 0,
        })),
      ).map((card) => [card.id, card.top]),
    )

    return (
      <>
        <style>{anchorStyle}</style>
        <div
          className="pointer-events-none absolute inset-y-0 hidden tablet:block"
          data-testid="margin-comments"
          style={{ left: lane.left }}
        >
          {placed.map((thread) => (
            <MarginCommentCard
              active={activeThread === thread.id}
              canComment={state.canComment}
              canResolveAny={state.canResolveAny}
              cardRef={(node) => {
                if (node) {
                  cardNodes.current.set(thread.id, node)
                } else {
                  cardNodes.current.delete(thread.id)
                }
              }}
              formatExact={formatExact}
              formatWhen={formatWhen}
              key={thread.id}
              onActivate={() => {
                setNow(Date.now())
                setActiveThread(thread.id)
              }}
              pending={pending}
              thread={thread}
              top={stacked.get(thread.id) ?? 0}
              viewer={viewer}
              viewerId={state.viewerId}
              width={lane.width}
              {...handlers}
            />
          ))}
        </div>
      </>
    )
  }

  const threadsByBlock = new Map<string, Array<CommentThread>>()

  for (const thread of placed) {
    const blockId = thread.blockId as string
    const group = threadsByBlock.get(blockId) ?? []

    group.push(thread)
    threadsByBlock.set(blockId, group)
  }

  const markers = layoutMarkers(
    [...threadsByBlock.keys()].map((blockId) => ({
      blockId,
      top: tops.get(blockId) as number,
    })),
  )

  return (
    <>
      <style>{anchorStyle}</style>
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
                      onGoToBlock={(target) => {
                        setOpenBlock(null)
                        focusCommentedBlock(target)
                      }}
                      pending={pending}
                      thread={thread}
                      viewerId={state.viewerId}
                      {...handlers}
                    />
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
    </>
  )
}

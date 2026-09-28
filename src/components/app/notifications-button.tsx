'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { NotificationList } from '@/components/app/notification-list'
import { sidebarIcon, sidebarRow } from '@/components/app/sidebar-styles'
import { NotificationIcon } from '@/components/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  countMyUnreadNotifications,
  loadMyNotifications,
  readMyNotifications,
} from '@/lib/notification-actions'
import type { NotificationItem } from '@/lib/notifications'
import { cn } from '@/shared/utils'

const refreshIntervalMs = 60_000

type Props = Readonly<{
  initialUnread: number
  onNavigate?: () => void
}>

type ListState =
  | Readonly<{ status: 'idle' | 'loading' | 'failed' }>
  | Readonly<{ status: 'ready'; items: ReadonlyArray<NotificationItem> }>

export function NotificationsButton({ initialUnread, onNavigate }: Props) {
  const t = useTranslations('notifications')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [list, setList] = useState<ListState>({ status: 'idle' })

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await countMyUnreadNotifications())
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshCount()
      }
    }, refreshIntervalMs)

    function handleFocus() {
      void refreshCount()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshCount])

  async function loadList() {
    setList({ status: 'loading' })

    try {
      const items = await loadMyNotifications()

      if (items === null) {
        setList({ status: 'failed' })

        return
      }

      setList({ items, status: 'ready' })

      if (items.some((item) => !item.read)) {
        await readMyNotifications()
      }

      setUnread(0)
    } catch {
      setList({ status: 'failed' })
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)

    if (next) {
      void loadList()
    }
  }

  function handleNavigate() {
    setOpen(false)
    onNavigate?.()
  }

  const now = new Date()

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={
            unread > 0 ? `${t('open')}, ${t('unread', { count: unread })}` : undefined
          }
          className={cn(sidebarRow, 'cursor-pointer font-medium')}
          type="button"
        >
          <NotificationIcon aria-hidden="true" className={sidebarIcon} />
          <span className="min-w-0 flex-1 truncate">{t('open')}</span>
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 font-semibold text-[11px] text-content-inverse"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(480px,70dvh)] w-[min(360px,calc(100vw-32px))] flex-col gap-1 overflow-y-auto bg-surface-card p-1.5"
        side="right"
      >
        <h2 className="px-3 pt-1.5 pb-1 font-semibold text-body-small text-content-strong">
          {t('title')}
        </h2>
        {list.status === 'ready' ? (
          <NotificationList
            items={list.items}
            onNavigate={handleNavigate}
            texts={{
              empty: t('empty'),
              emptyHint: t('emptyHint'),
              mentioned: (actor) => t('mentioned', { actor }),
              someone: t('someone'),
              when: (at) => format.relativeTime(new Date(at), now),
            }}
          />
        ) : null}
        {list.status === 'failed' ? (
          <p className="px-3 py-4 text-caption text-content-subtle" role="alert">
            {t('loadFailed')}
          </p>
        ) : null}
        {list.status === 'loading' || list.status === 'idle' ? (
          <div aria-busy="true" className="flex flex-col gap-2 px-3 py-3">
            <div className="h-10 animate-pulse rounded-medium bg-surface-subtle" />
            <div className="h-10 animate-pulse rounded-medium bg-surface-subtle" />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

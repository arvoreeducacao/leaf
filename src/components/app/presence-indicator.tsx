'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

import { usePresence } from '@/components/editor/presence-bridge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  realtimeColorFor,
  realtimeInitials,
  realtimeTextColorFor,
} from '@/lib/realtime-user'

const maxAvatars = 4

export function PresenceIndicator() {
  const t = useTranslations('realtime')
  const { resolvedTheme } = useTheme()
  const { active, peers } = usePresence()

  if (!active || peers.length < 2) {
    return null
  }

  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const shown = peers.slice(0, maxAvatars)
  const overflow = peers.length - shown.length
  const names = peers
    .map((peer) => (peer.isSelf ? t('you', { name: peer.name }) : peer.name))
    .join(', ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          aria-label={t('peopleHere', { count: peers.length })}
          className="flex items-center"
          data-testid="presence-indicator"
          role="group"
        >
          <ul className="flex items-center">
            {shown.map((peer) => {
              const color = realtimeColorFor(
                peer.userId ?? String(peer.clientId),
                theme,
              )

              return (
                <li
                  className="-ml-1.5 rounded-full border-2 border-surface-app first:ml-0"
                  key={peer.clientId}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-5.5 items-center justify-center rounded-full font-semibold text-[10px]"
                    style={{
                      backgroundColor: color,
                      color: realtimeTextColorFor(color),
                    }}
                  >
                    {realtimeInitials(peer.name)}
                  </span>
                </li>
              )
            })}
          </ul>
          {overflow > 0 ? (
            <span
              aria-hidden="true"
              className="-ml-1.5 flex size-5.5 items-center justify-center rounded-full border-2 border-surface-app bg-surface-subtle font-semibold text-[10px] text-content"
            >
              {`+${overflow}`}
            </span>
          ) : null}
          <span className="sr-only">{names}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{names}</TooltipContent>
    </Tooltip>
  )
}

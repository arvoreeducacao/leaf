import Link from 'next/link'

import { DocumentIcon } from '@/components/app/document-icon'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { NotificationItem } from '@/lib/notifications'
import { cn } from '@/shared/utils'

export type NotificationListTexts = Readonly<{
  empty: string
  emptyHint: string
  someone: string
  mentioned: (actor: string) => string
  when: (at: string) => string
}>

type Props = Readonly<{
  items: ReadonlyArray<NotificationItem>
  texts: NotificationListTexts
  onNavigate?: () => void
}>

export function NotificationList({ items, texts, onNavigate }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-1 px-3 py-6 text-center">
        <p className="font-medium text-body-small text-content-strong">
          {texts.empty}
        </p>
        <p className="text-caption text-content-subtle">{texts.emptyHint}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            className={cn(
              'flex items-start gap-2.5 rounded-medium px-3 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1',
              !item.read && 'bg-brand-surface/60',
            )}
            href={`/doc/${item.documentId}`}
            onClick={onNavigate}
          >
            <UserAvatar
              className="mt-0.5 size-6"
              image={item.actorImage}
              name={item.actorName ?? texts.someone}
              userId={item.actorId ?? item.id}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body-small text-content">
                {texts.mentioned(item.actorName ?? texts.someone)}
              </span>
              <span className="flex min-w-0 items-center gap-1 font-medium text-body-small text-content-strong">
                <DocumentIcon
                  className="size-4 shrink-0 text-content-subtle"
                  icon={item.documentIcon}
                  kind="page"
                />
                <span className="truncate">{item.documentTitle}</span>
              </span>
              <span className="text-caption text-content-subtle">
                {texts.when(item.createdAt)}
              </span>
            </span>
            {item.read ? null : (
              <span
                aria-hidden="true"
                className="mt-2 size-2 shrink-0 rounded-full bg-brand"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

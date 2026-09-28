import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { NotificationList } from '@/components/app/notification-list'
import type { NotificationItem } from '@/lib/notifications'

const texts = {
  empty: 'Nothing here yet',
  emptyHint: 'Mentions show up here.',
  mentioned: (actor: string) => `${actor} mentioned you in`,
  someone: 'Someone',
  when: () => '2 minutes ago',
}

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    actorId: 'user-ana',
    actorImage: null,
    actorName: 'Ana Lima',
    createdAt: '2026-09-28T12:00:00.000Z',
    documentIcon: null,
    documentId: 'doc-1',
    documentTitle: 'Planning',
    id: 'n1',
    kind: 'mention',
    read: false,
    ...overrides,
  }
}

function render(items: Array<NotificationItem>) {
  return renderToStaticMarkup(createElement(NotificationList, { items, texts }))
}

describe('NotificationList', () => {
  it('explains the empty inbox', () => {
    const html = render([])

    expect(html).toContain('Nothing here yet')
    expect(html).toContain('Mentions show up here.')
  })

  it('links each mention to its page with who mentioned and when', () => {
    const html = render([item()])

    expect(html).toContain('href="/doc/doc-1"')
    expect(html).toContain('Ana Lima mentioned you in')
    expect(html).toContain('Planning')
    expect(html).toContain('2 minutes ago')
  })

  it('names someone when the author left', () => {
    expect(render([item({ actorId: null, actorName: null })])).toContain(
      'Someone mentioned you in',
    )
  })

  it('marks only unread items', () => {
    expect(render([item()])).toContain('bg-brand')
    expect(render([item({ read: true })])).not.toContain('bg-brand')
  })
})

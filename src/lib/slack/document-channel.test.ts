import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { threadPermalink } from './document-channel'

describe('threadPermalink', () => {
  it('points at the message that opened the thread', () => {
    expect(
      threadPermalink({
        channelId: 'C0BSJQCKCDN',
        documentId: 'doc-a',
        messageTs: '1788639138.231400',
        viewId: 'view-a',
      }),
    ).toBe('https://slack.com/archives/C0BSJQCKCDN/p1788639138231400')
  })
})

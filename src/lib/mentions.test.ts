import { describe, expect, it } from 'vitest'

import {
  MAX_MENTION_KEY_LENGTH,
  addedMentions,
  mentionsInContent,
} from '@/lib/mentions'

function mention(userId: string, mentionId = '') {
  return { props: { mentionId, name: userId, userId }, type: 'mention' }
}

describe('mentionsInContent', () => {
  it('finds mentions in paragraphs, nested blocks and table cells', () => {
    const content = JSON.stringify([
      {
        children: [{ content: [mention('user-b', 'm2')], type: 'paragraph' }],
        content: [{ text: 'Hi ', type: 'text' }, mention('user-a', 'm1')],
        type: 'paragraph',
      },
      {
        content: {
          rows: [{ cells: [[mention('user-c', 'm3')]] }],
          type: 'tableContent',
        },
        type: 'table',
      },
      {
        content: {
          rows: [
            {
              cells: [
                { content: [mention('user-d', 'm4')], type: 'tableCell' },
              ],
            },
          ],
          type: 'tableContent',
        },
        type: 'table',
      },
    ])

    expect(mentionsInContent(content)).toEqual([
      { key: 'm1', userId: 'user-a' },
      { key: 'm2', userId: 'user-b' },
      { key: 'm3', userId: 'user-c' },
      { key: 'm4', userId: 'user-d' },
    ])
  })

  it('falls back to one key per person when the mention has no id', () => {
    const content = JSON.stringify([
      { content: [mention('user-a'), mention('user-a')], type: 'paragraph' },
    ])

    expect(mentionsInContent(content)).toEqual([
      { key: 'user:user-a', userId: 'user-a' },
    ])
  })

  it('ignores mentions without a person and unreadable content', () => {
    expect(
      mentionsInContent(
        JSON.stringify([{ content: [mention('')], type: 'paragraph' }]),
      ),
    ).toEqual([])
    expect(mentionsInContent('not json')).toEqual([])
    expect(mentionsInContent(null)).toEqual([])
  })

  it('caps the key to what the database stores', () => {
    const content = JSON.stringify([
      { content: [mention('user-a', 'x'.repeat(200))], type: 'paragraph' },
    ])

    expect(mentionsInContent(content)[0].key).toHaveLength(
      MAX_MENTION_KEY_LENGTH,
    )
  })
})

describe('addedMentions', () => {
  it('returns only the mentions missing from the previous content', () => {
    const before = JSON.stringify([
      { content: [mention('user-a', 'm1')], type: 'paragraph' },
    ])
    const after = JSON.stringify([
      {
        content: [mention('user-a', 'm1'), mention('user-b', 'm2')],
        type: 'paragraph',
      },
    ])

    expect(addedMentions(before, after)).toEqual([
      { key: 'm2', userId: 'user-b' },
    ])
    expect(addedMentions(after, before)).toEqual([])
  })
})

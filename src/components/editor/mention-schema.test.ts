import { ServerBlockNoteEditor } from '@blocknote/server-util'
import { describe, expect, it } from 'vitest'

import { blocksToPlainText } from '@/components/editor/text-stats'
import {
  contentFromRealtimeState,
  seedUpdateFromContent,
} from '@/lib/realtime-document'
import { mentionsInContent } from '@/lib/mentions'

import { leafSchema } from './schema'
import { leafServerSchema } from './server-schema'

const content = JSON.stringify([
  {
    content: [
      { styles: {}, text: 'Ask ', type: 'text' },
      {
        props: { mentionId: 'm1', name: 'Ana Lima', userId: 'user-ana' },
        type: 'mention',
      },
      { styles: {}, text: ' about it', type: 'text' },
    ],
    type: 'paragraph',
  },
])

describe('the mention inline content', () => {
  it('is part of the editor and the server schemas', () => {
    expect(Object.keys(leafSchema.inlineContentSchema)).toContain('mention')
    expect(Object.keys(leafServerSchema.inlineContentSchema)).toContain(
      'mention',
    )
  })

  it('survives the trip through the realtime document', () => {
    const seed = seedUpdateFromContent(content)

    expect(seed.status).toBe('ok')

    if (seed.status !== 'ok') {
      return
    }

    const restored = contentFromRealtimeState(seed.update)

    expect(mentionsInContent(restored)).toEqual([
      { key: 'm1', userId: 'user-ana' },
    ])
    expect(restored).toContain('"name":"Ana Lima"')
  })

  it('exports as the person name', async () => {
    const editor = ServerBlockNoteEditor.create({ schema: leafServerSchema })
    const markdown = await editor.blocksToMarkdownLossy(JSON.parse(content))

    expect(markdown).toContain('Ask @Ana Lima about it')
  })

  it('reads as the person name in plain text', () => {
    expect(blocksToPlainText(JSON.parse(content))).toContain(
      'Ask @Ana Lima about it',
    )
  })
})

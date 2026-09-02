import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { realtimeFragmentName } from './realtime'
import {
  contentFromRealtimeState,
  seedUpdateFromContent,
} from './realtime-document'

const sample = JSON.stringify([
  {
    id: 'block-1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Collaboration', styles: {} }],
    children: [],
  },
  {
    id: 'block-2',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Two people on the same text', styles: {} }],
    children: [],
  },
])

function roundTrip(content: string | null) {
  const seed = seedUpdateFromContent(content)

  if (seed.status !== 'ok') {
    throw new Error('seed unexpectedly unreadable')
  }

  return contentFromRealtimeState(seed.update)
}

describe('seedUpdateFromContent', () => {
  it('generates the same document for the same content', () => {
    expect(roundTrip(sample)).toBe(roundTrip(sample))
  })

  it('duplicates the content when two seeds are applied to the same room', () => {
    const first = seedUpdateFromContent(sample)
    const second = seedUpdateFromContent(sample)

    if (first.status !== 'ok' || second.status !== 'ok') {
      throw new Error('seed unexpectedly unreadable')
    }

    const doc = new Y.Doc({ gc: true })

    Y.applyUpdate(doc, first.update)
    Y.applyUpdate(doc, second.update)

    const fragment = doc.getXmlFragment(realtimeFragmentName).toString()

    doc.destroy()

    expect(fragment.split('<blockgroup>').length - 1).toBe(2)
  })

  it('preserves text and types on the round trip', () => {
    const result = roundTrip(sample)

    expect(result).not.toBeNull()

    const blocks = JSON.parse(result as string) as Array<{
      type: string
      content: Array<{ text: string }>
    }>

    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph'])
    expect(blocks[0].content[0].text).toBe('Collaboration')
    expect(blocks[1].content[0].text).toBe('Two people on the same text')
  })

  it('seeds an empty paragraph for a document without content', () => {
    const result = roundTrip(null)

    expect(result).not.toBeNull()

    const blocks = JSON.parse(result as string) as Array<{ type: string }>

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
  })

  it('rejects unreadable content instead of wiping the document', () => {
    expect(seedUpdateFromContent('{ not json').status).toBe('unreadable')
  })
})

describe('contentFromRealtimeState', () => {
  it('returns null when the state is not a Yjs update', () => {
    expect(contentFromRealtimeState(new Uint8Array([9, 9, 9, 9]))).toBeNull()
  })
})

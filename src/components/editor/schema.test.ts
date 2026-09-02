import { ServerBlockNoteEditor } from '@blocknote/server-util'
import { describe, expect, it } from 'vitest'

import { leafSchema } from './schema'
import { leafServerSchema } from './server-schema'

const server = ServerBlockNoteEditor.create({ schema: leafSchema })

async function typesFor(markdown: string) {
  const blocks = await server.tryParseMarkdownToBlocks(markdown)

  return blocks.map((block) => block.type)
}

describe('leafSchema', () => {
  it('exposes the blocks used by the markdown shortcuts', () => {
    expect(Object.keys(leafSchema.blockSchema)).toEqual(
      expect.arrayContaining([
        'paragraph',
        'heading',
        'bulletListItem',
        'numberedListItem',
        'checkListItem',
        'quote',
        'divider',
        'codeBlock',
        'table',
        'image',
        'callout',
      ])
    )
  })

  it('turns markdown titles into heading blocks', async () => {
    await expect(typesFor('# Title')).resolves.toEqual(['heading'])
  })

  it('turns markdown lists into list blocks', async () => {
    await expect(typesFor('- one\n- two')).resolves.toEqual([
      'bulletListItem',
      'bulletListItem',
    ])
    await expect(typesFor('1. one\n2. two')).resolves.toEqual([
      'numberedListItem',
      'numberedListItem',
    ])
    await expect(typesFor('- [ ] task')).resolves.toEqual(['checkListItem'])
  })

  it('turns markdown quote and code fence into their blocks', async () => {
    await expect(typesFor('> quote')).resolves.toEqual(['quote'])
    await expect(typesFor('```\ncode\n```')).resolves.toEqual(['codeBlock'])
  })

  it('exports the database block as a link through the server schema', async () => {
    const serverEditor = ServerBlockNoteEditor.create({
      schema: leafServerSchema,
    })

    const html = await serverEditor.blocksToHTMLLossy([
      { type: 'database', props: { databaseId: 'abc123def456' } },
    ])

    expect(html).toContain('/doc/abc123def456')
  })

  it('exposes the same block types as the server schema', () => {
    expect(Object.keys(leafSchema.blockSchema).sort()).toEqual(
      Object.keys(leafServerSchema.blockSchema).sort()
    )
  })
})

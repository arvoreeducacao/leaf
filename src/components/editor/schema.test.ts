import { ServerBlockNoteEditor } from '@blocknote/server-util'
import { describe, expect, it } from 'vitest'

import { leafSchema } from './schema'

const server = ServerBlockNoteEditor.create({ schema: leafSchema })

async function typesFor(markdown: string) {
  const blocks = await server.tryParseMarkdownToBlocks(markdown)

  return blocks.map((block) => block.type)
}

describe('leafSchema', () => {
  it('expõe os blocos usados pelos atalhos de markdown', () => {
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

  it('converte títulos de markdown em heading', async () => {
    await expect(typesFor('# Título')).resolves.toEqual(['heading'])
  })

  it('converte listas de markdown nos blocos de lista', async () => {
    await expect(typesFor('- um\n- dois')).resolves.toEqual([
      'bulletListItem',
      'bulletListItem',
    ])
    await expect(typesFor('1. um\n2. dois')).resolves.toEqual([
      'numberedListItem',
      'numberedListItem',
    ])
    await expect(typesFor('- [ ] tarefa')).resolves.toEqual(['checkListItem'])
  })

  it('converte citação e bloco de código de markdown', async () => {
    await expect(typesFor('> citação')).resolves.toEqual(['quote'])
    await expect(typesFor('```\ncodigo\n```')).resolves.toEqual(['codeBlock'])
  })
})

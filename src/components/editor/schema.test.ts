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

  it('exporta o bloco de base de dados como link pelo schema do servidor', async () => {
    const serverEditor = ServerBlockNoteEditor.create({
      schema: leafServerSchema,
    })

    const html = await serverEditor.blocksToHTMLLossy([
      { type: 'database', props: { databaseId: 'abc123def456' } },
    ])

    expect(html).toContain('/doc/abc123def456')
  })

  it('expõe os mesmos tipos de bloco do schema do servidor', () => {
    expect(Object.keys(leafSchema.blockSchema).sort()).toEqual(
      Object.keys(leafServerSchema.blockSchema).sort()
    )
  })
})

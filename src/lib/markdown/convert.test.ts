import type { PartialBlock } from '@blocknote/core'
import { describe, expect, it } from 'vitest'

import {
  absolutizeBlocks,
  contentToHTML,
  contentToMarkdown,
  documentToMarkdownFile,
  fixExportedHTML,
  markdownToContent,
  parseContentBlocks,
} from '@/lib/markdown/convert'
import { titleFromFileName, toFileSlug } from '@/lib/markdown/filename'
import { sanitizeMarkdown, sanitizeUrl } from '@/lib/markdown/sanitize'

const fixture = [
  '# Relatório de leitura',
  '',
  '## Resumo da turma',
  '',
  'Parágrafo com **negrito**, *itálico*, `código` e um [link](https://arvore.com.br).',
  '',
  '- Primeiro item',
  '  - Item aninhado',
  '  - Outro aninhado',
  '- Segundo item',
  '',
  '1. Passo um',
  '2. Passo dois',
  '',
  '- [ ] Enviar convite',
  '- [x] Confirmar presença',
  '',
  '| Aluno | Livros |',
  '| --- | --- |',
  '| Ana | 12 |',
  '| Bruno | 7 |',
  '',
  '```ts',
  'const total = 19',
  '```',
  '',
  '![Capa do livro](https://exemplo.com.br/capa.png)',
  '',
  '> Ler é crescer.',
  '',
].join('\n')

async function roundTrip(markdown: string) {
  return contentToMarkdown(await markdownToContent(markdown))
}

function propsOf(block: PartialBlock): Record<string, unknown> {
  return (block.props ?? {}) as Record<string, unknown>
}

describe('round-trip de markdown', () => {
  it('preserva o documento inteiro a menos do marcador de lista e do preenchimento da tabela', async () => {
    const result = await roundTrip(fixture)

    expect(result.trim()).toBe(
      [
        '# Relatório de leitura',
        '',
        '## Resumo da turma',
        '',
        'Parágrafo com **negrito**, *itálico*, `código` e um [link](https://arvore.com.br).',
        '',
        '* Primeiro item',
        '  * Item aninhado',
        '  * Outro aninhado',
        '* Segundo item',
        '',
        '1. Passo um',
        '2. Passo dois',
        '',
        '* [ ] Enviar convite',
        '* [x] Confirmar presença',
        '',
        '| Aluno      | Livros     |',
        '| ---------- | ---------- |',
        '| Ana        | 12         |',
        '| Bruno      | 7          |',
        '',
        '```ts',
        'const total = 19',
        '```',
        '',
        '![Capa do livro](https://exemplo.com.br/capa.png)',
        '',
        '> Ler é crescer.',
      ].join('\n'),
    )
  })

  it('preserva os níveis de heading', async () => {
    const result = await roundTrip('# Um\n\n## Dois\n\n### Três\n')

    expect(result.trim()).toBe('# Um\n\n## Dois\n\n### Três')
  })

  it('preserva o aninhamento das listas', async () => {
    const result = await roundTrip('- pai\n  - filho\n    - neto\n')

    expect(result.trim()).toBe('* pai\n  * filho\n    * neto')
  })

  it('preserva o estado de cada item da checklist', async () => {
    const content = await markdownToContent('- [x] feito\n- [ ] pendente\n')
    const blocks = parseContentBlocks(content)

    expect(blocks.map((block) => block.type)).toEqual([
      'checkListItem',
      'checkListItem',
    ])
    expect(blocks.map((block) => propsOf(block).checked)).toEqual([true, false])
  })

  it('preserva a linguagem do code fence', async () => {
    const content = await markdownToContent('```python\nprint(1)\n```\n')
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('codeBlock')
    expect(propsOf(blocks[0]).language).toBe('python')
  })

  it('preserva o texto alternativo e a url da imagem', async () => {
    const content = await markdownToContent(
      '![Capa](https://exemplo.com.br/a.png)\n',
    )
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('image')
    expect(propsOf(blocks[0]).name).toBe('Capa')
    expect(propsOf(blocks[0]).url).toBe('https://exemplo.com.br/a.png')
  })

  it('preserva negrito, itálico e riscado', async () => {
    const result = await roundTrip('**a** *b* ~~c~~\n')

    expect(result.trim()).toBe('**a** *b* ~~c~~')
  })

  it('preserva a tabela como bloco de tabela', async () => {
    const content = await markdownToContent(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
    )
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('table')
  })
})

describe('perdas aceitas do round-trip', () => {
  it('troca o marcador de lista de - para *', async () => {
    expect((await roundTrip('- item\n')).trim()).toBe('* item')
  })

  it('perde o alinhamento das colunas da tabela', async () => {
    const result = await roundTrip('| a | b |\n| :--- | ---: |\n| 1 | 2 |\n')

    expect(result).toContain('| ---------- | ---------- |')
    expect(result).not.toContain(':---')
  })

  it('rebaixa bloco de HTML bruto para parágrafo simples', async () => {
    const result = await roundTrip('<div class="callout">Aviso</div>\n')

    expect(result.trim()).toBe('Aviso')
  })

  it('converte heading setext em heading com cerquilha', async () => {
    const result = await roundTrip('Titulo\n======\n')

    expect(result.trim()).toBe('# Titulo')
  })

  it('mantém a nota de rodapé apenas como texto', async () => {
    const content = await markdownToContent('texto[^1]\n\n[^1]: nota\n')
    const blocks = parseContentBlocks(content)

    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'paragraph'])
  })
})

describe('sanitização do import', () => {
  it('remove tag de script do markdown', () => {
    const result = sanitizeMarkdown('antes\n\n<script>alert(1)</script>\n\ndepois')

    expect(result).not.toContain('script')
    expect(result).toContain('antes')
    expect(result).toContain('depois')
  })

  it('remove iframe, style e object', () => {
    const result = sanitizeMarkdown(
      '<iframe src="https://evil.com"></iframe><style>a{}</style><object data="x"></object>',
    )

    expect(result.trim()).toBe('')
  })

  it('remove event handlers inline', () => {
    const result = sanitizeMarkdown('<span onmouseover="alert(1)">oi</span>')

    expect(result).not.toContain('onmouseover')
  })

  it('preserva HTML dentro de code fence', () => {
    const source = '```html\n<script>alert(1)</script>\n```\n'

    expect(sanitizeMarkdown(source)).toBe(source)
  })

  it('preserva HTML dentro de code span', () => {
    const source = 'use `<script>` para isso'

    expect(sanitizeMarkdown(source)).toBe(source)
  })

  it('zera url de imagem com protocolo javascript', async () => {
    const content = await markdownToContent('![x](javascript:alert(1))\n')
    const blocks = parseContentBlocks(content)

    expect(propsOf(blocks[0]).url).toBe('')
  })

  it('não produz link com protocolo javascript', async () => {
    const content = await markdownToContent('[clique](javascript:alert(1))\n')

    expect(content).not.toContain('javascript:')
  })

  it('não deixa javascript no HTML exportado', async () => {
    const content = await markdownToContent(
      '![x](javascript:alert(1))\n\n<img src=y onerror="alert(1)">\n',
    )
    const html = await contentToHTML(content, 'Documento')

    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onerror')
  })

  it('escapa o título no HTML exportado', async () => {
    const html = await contentToHTML(null, '<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('aceita apenas http, https e mailto', () => {
    expect(sanitizeUrl('https://arvore.com.br')).toBe('https://arvore.com.br')
    expect(sanitizeUrl('http://arvore.com.br')).toBe('http://arvore.com.br')
    expect(sanitizeUrl('mailto:oi@arvore.com.br')).toBe('mailto:oi@arvore.com.br')
    expect(sanitizeUrl('/api/uploads/u/1.png')).toBe('/api/uploads/u/1.png')
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('')
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
  })
})

describe('bloco de destaque', () => {
  const callout = JSON.stringify([
    {
      type: 'callout',
      content: [{ type: 'text', text: 'Leia com atenção', styles: {} }],
    },
  ])

  it('mantém o bloco callout depois de passar pelo parser', () => {
    const blocks = parseContentBlocks(callout)

    expect(blocks[0].type).toBe('callout')
  })

  it('degrada o destaque para citação no markdown exportado', async () => {
    const result = await contentToMarkdown(callout)

    expect(result.trim()).toBe('> Leia com atenção')
  })

  it('degrada o destaque para blockquote no HTML exportado', async () => {
    const html = await contentToHTML(callout, 'Documento')

    expect(html).toContain('<blockquote>')
    expect(html).toContain('Leia com atenção')
  })
})

describe('conteúdo vazio', () => {
  it('devolve markdown vazio quando não há conteúdo', async () => {
    expect(await contentToMarkdown(null)).toBe('')
    expect(await contentToMarkdown('')).toBe('')
    expect(await contentToMarkdown('não é json')).toBe('')
  })
})

describe('nome de arquivo', () => {
  it('usa o nome do arquivo sem extensão como título', () => {
    expect(titleFromFileName('Plano de aula.md', 'Sem título')).toBe(
      'Plano de aula',
    )
    expect(titleFromFileName('notas.markdown', 'Sem título')).toBe('notas')
    expect(titleFromFileName('.md', 'Sem título')).toBe('Sem título')
  })

  it('gera slug sem acento nem espaço', () => {
    expect(toFileSlug('Relatório de leitura')).toBe('relatorio-de-leitura')
    expect(toFileSlug('   ')).toBe('documento')
  })
})

describe('export com imagem interna', () => {
  const content = JSON.stringify([
    {
      type: 'image',
      props: { url: '/api/uploads/u/abc.png', caption: '', previewWidth: 400 },
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'link',
          href: '/doc/xyz',
          content: [{ type: 'text', text: 'outra página', styles: {} }],
        },
        {
          type: 'link',
          href: 'https://arvore.com.br',
          content: [{ type: 'text', text: 'externo', styles: {} }],
        },
      ],
    },
  ])

  it('reescreve url interna para absoluta no markdown', async () => {
    const markdown = await contentToMarkdown(content, 'http://localhost:3000')

    expect(markdown).toContain('http://localhost:3000/api/uploads/u/abc.png')
    expect(markdown).toContain('http://localhost:3000/doc/xyz')
    expect(markdown).toContain('https://arvore.com.br')
  })

  it('mantém a url relativa quando não há origem', async () => {
    const markdown = await contentToMarkdown(content)

    expect(markdown).toContain('/api/uploads/u/abc.png')
    expect(markdown).not.toContain('http://localhost:3000')
  })

  it('não duplica a origem em url absoluta', async () => {
    const html = await contentToHTML(content, 'Doc', 'http://localhost:3000')

    expect(html).not.toContain('http://localhost:3000https://')
  })
})

describe('html exportado', () => {
  it('corrige o atributo classname do BlockNote', () => {
    expect(fixExportedHTML('<a classname="bn-link" href="#">x</a>')).toBe(
      '<a class="bn-link" href="#">x</a>',
    )
  })

  it('não emite classname no html de um link', async () => {
    const content = await markdownToContent(
      'Veja o [guia](https://arvore.com.br).',
    )
    const html = await contentToHTML(content, 'Doc')

    expect(html).not.toContain('classname=')
    expect(html).toContain('href="https://arvore.com.br"')
  })
})

describe('absolutizeBlocks', () => {
  it('não altera nada quando a origem é vazia', () => {
    const blocks = [{ type: 'image', props: { url: '/a.png' } }]

    expect(absolutizeBlocks(blocks, '')).toBe(blocks)
  })

  it('ignora url protocolo relativo', () => {
    const result = absolutizeBlocks(
      [{ type: 'image', props: { url: '//cdn.example.com/a.png' } }],
      'http://localhost:3000',
    ) as Array<{ props: { url: string } }>

    expect(result[0].props.url).toBe('//cdn.example.com/a.png')
  })
})

describe('título no arquivo exportado', () => {
  it('não repete o título quando o conteúdo já começa com o mesmo h1', async () => {
    const content = await markdownToContent('# Plano de aula\n\nCorpo do texto.')
    const blocks = parseContentBlocks(content)
    const body = await contentToMarkdown(content)

    const file = documentToMarkdownFile('Plano de aula', body, blocks)

    expect(file.match(/# Plano de aula/g)).toHaveLength(1)

    const html = await contentToHTML(content, 'Plano de aula')

    expect(html.match(/Plano de aula<\/h1>/g)).toHaveLength(1)
  })

  it('prefixa o título quando o conteúdo começa com outra coisa', async () => {
    const content = await markdownToContent('Só um parágrafo.')
    const blocks = parseContentBlocks(content)
    const body = await contentToMarkdown(content)

    expect(documentToMarkdownFile('Plano de aula', body, blocks)).toContain(
      '# Plano de aula',
    )
  })
})

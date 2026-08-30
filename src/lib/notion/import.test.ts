import { zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('@/db/schema')

  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const folder = join(process.cwd(), 'drizzle')
  const files = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const contents = readFileSync(join(folder, file), 'utf8')

    for (const statement of contents.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()

      if (trimmed.length > 0) {
        sqlite.exec(trimmed)
      }
    }
  }

  return { db: drizzle(sqlite, { schema }), schema }
})

const uploads: Array<{ key: string; contentType: string; size: number }> = []

vi.mock('@/lib/storage', () => ({
  storage: {
    put: async (key: string, body: Buffer, contentType: string) => {
      uploads.push({ key, contentType, size: body.byteLength })
    },
    get: async () => null,
  },
}))

import type { PartialBlock } from '@blocknote/core'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents, user } from '@/db/schema'
import { parseContentBlocks } from '@/lib/markdown/convert'
import { csvToMarkdownTable, parseCsv } from '@/lib/notion/csv'
import { buildNotionFixtureZip, fixtureTitles } from '@/lib/notion/fixture'
import { importNotionZip } from '@/lib/notion/import'
import type { ImportEvent, ImportSummary } from '@/lib/notion/import'
import { notionTitle } from '@/lib/notion/paths'
import { buildImportPlan } from '@/lib/notion/plan'
import { NotionImportError, readZipEntries } from '@/lib/notion/zip'

import { createTranslator } from 'next-intl'

import ptBR from '../../../messages/pt-BR.json'
import { buildNotionImportMessages } from '@/lib/notion/messages'

const messages = buildNotionImportMessages(
  createTranslator({
    locale: 'pt-BR',
    messages: ptBR,
    namespace: 'archiveImport',
  }) as (
    key: string,
    values?: Record<string, string | number | Date>,
  ) => string,
  ptBR.document.untitled,
)

const owner = { id: 'user-owner', email: 'dono@arvore.com.br' }

async function runImport(data: Uint8Array) {
  const events: Array<ImportEvent> = []
  let summary: ImportSummary | null = null
  let error: string | null = null

  for await (const event of importNotionZip(data, owner, messages)) {
    events.push(event)

    if (event.type === 'done') {
      summary = event.summary
    }

    if (event.type === 'error') {
      error = event.error
    }
  }

  return { events, summary, error }
}

async function documentByTitle(title: string) {
  const row = await db.query.documents.findFirst({
    where: eq(documents.title, title),
  })

  if (!row) {
    throw new Error(`documento não encontrado: ${title}`)
  }

  return row
}

function blockTypes(blocks: Array<PartialBlock>): Array<string> {
  return blocks.flatMap((block) => [
    block.type as string,
    ...blockTypes((block.children ?? []) as Array<PartialBlock>),
  ])
}

function textOf(blocks: Array<PartialBlock>): string {
  return JSON.stringify(blocks)
}

beforeEach(async () => {
  uploads.length = 0

  await db.delete(documents)
  await db.delete(user)
  await db.insert(user).values({
    id: owner.id,
    name: 'Dono',
    email: owner.email,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('import do export do Notion', () => {
  it('monta a hierarquia de três níveis com títulos sem o hash', async () => {
    const { summary, error } = await runImport(buildNotionFixtureZip())

    expect(error).toBeNull()
    expect(summary?.pages).toBe(5)

    const plano = await documentByTitle(fixtureTitles.plano)
    const turma = await documentByTitle(fixtureTitles.turma)
    const aluno = await documentByTitle(fixtureTitles.aluno)

    expect(plano.parentId).toBeNull()
    expect(turma.parentId).toBe(plano.id)
    expect(aluno.parentId).toBe(turma.id)
  })

  it('põe a database csv como página filha e a linha com md como subpágina dela', async () => {
    await runImport(buildNotionFixtureZip())

    const plano = await documentByTitle(fixtureTitles.plano)
    const alunos = await documentByTitle(fixtureTitles.alunos)
    const ana = await documentByTitle(fixtureTitles.ana)

    expect(alunos.parentId).toBe(plano.id)
    expect(ana.parentId).toBe(alunos.id)

    const blocks = parseContentBlocks(alunos.content)

    expect(blockTypes(blocks)).toContain('table')
    expect(textOf(blocks)).toContain('biografias')
  })

  it('envia a imagem para o storage e reescreve a url no bloco', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())

    expect(summary?.assets).toBe(2)
    expect(uploads.some((item) => item.contentType === 'image/png')).toBe(true)

    const turma = await documentByTitle(fixtureTitles.turma)
    const blocks = parseContentBlocks(turma.content)
    const image = blocks.find((block) => block.type === 'image')

    expect(image).toBeDefined()
    expect(
      (image?.props as Record<string, unknown> | undefined)?.url,
    ).toMatch(/^\/api\/uploads\/u\/[\w-]+\.png$/)
  })

  it('reescreve o link interno para a rota do documento criado', async () => {
    await runImport(buildNotionFixtureZip())

    const plano = await documentByTitle(fixtureTitles.plano)
    const turma = await documentByTitle(fixtureTitles.turma)
    const blocks = parseContentBlocks(plano.content)

    expect(textOf(blocks)).toContain(`/doc/${turma.id}`)
  })

  it('transforma anexo que não é imagem em link', async () => {
    await runImport(buildNotionFixtureZip())

    const turma = await documentByTitle(fixtureTitles.turma)
    const blocks = parseContentBlocks(turma.content)
    const serialized = textOf(blocks)

    expect(serialized).toContain('.pdf')
    expect(blockTypes(blocks)).not.toContain('file')
  })

  it('converte aside e citação com emoji em bloco de destaque', async () => {
    await runImport(buildNotionFixtureZip())

    const plano = await documentByTitle(fixtureTitles.plano)
    const turma = await documentByTitle(fixtureTitles.turma)

    expect(blockTypes(parseContentBlocks(plano.content))).toContain('callout')

    const turmaBlocks = parseContentBlocks(turma.content)

    expect(blockTypes(turmaBlocks)).toContain('callout')
    expect(textOf(turmaBlocks)).not.toContain('💡')
  })

  it('não repete o título do documento como primeiro bloco', async () => {
    await runImport(buildNotionFixtureZip())

    const plano = await documentByTitle(fixtureTitles.plano)
    const blocks = parseContentBlocks(plano.content)
    const first = blocks[0]

    expect(first.type).not.toBe('heading')
    expect(textOf([first])).not.toContain(fixtureTitles.plano)
  })

  it('avisa que a lista de alternância perdeu o comportamento de abrir e fechar', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())

    expect(
      summary?.warnings.some((warning) => warning.includes('alternância')),
    ).toBe(true)
  })

  it('devolve o documento raiz para abrir depois da importação', async () => {
    const { summary } = await runImport(buildNotionFixtureZip())
    const plano = await documentByTitle(fixtureTitles.plano)

    expect(summary?.rootId).toBe(plano.id)
    expect(summary?.rootTitle).toBe(fixtureTitles.plano)
  })

  it('recusa zip sem nenhuma página', async () => {
    const empty = zipSync({ 'leia-me.txt': new TextEncoder().encode('oi') })
    const { error, summary } = await runImport(empty)

    expect(summary).toBeNull()
    expect(error).toContain('Não encontramos páginas')
  })
})

describe('segurança do zip', () => {
  it('rejeita caminho que sobe de diretório', () => {
    const data = zipSync({
      'pagina.md': new TextEncoder().encode('# ok'),
      '../fora.md': new TextEncoder().encode('# fora'),
    })

    expect(() => readZipEntries(data, messages)).toThrow(NotionImportError)
  })

  it('rejeita caminho absoluto', () => {
    const data = zipSync({
      '/etc/passwd': new TextEncoder().encode('root'),
    })

    expect(() => readZipEntries(data, messages)).toThrow(NotionImportError)
  })

  it('rejeita quando o tamanho descompactado declarado passa do limite', () => {
    const data = zipSync({
      'bomba.md': new Uint8Array(64 * 1024),
    })

    expect(() => readZipEntries(data, messages, { maxBytes: 1024 })).toThrow(
      NotionImportError,
    )
  })

  it('rejeita quando passa do número de arquivos', () => {
    const files: Record<string, Uint8Array> = {}

    for (let index = 0; index < 12; index += 1) {
      files[`p${index}.md`] = new TextEncoder().encode('# x')
    }

    expect(() => readZipEntries(data(files), messages, { maxEntries: 10 })).toThrow(
      NotionImportError,
    )
  })

  it('ignora lixo do sistema operacional', () => {
    const entries = readZipEntries(
      data({
        '__MACOSX/._pagina.md': new TextEncoder().encode('lixo'),
        'pagina.md': new TextEncoder().encode('# ok'),
        '.DS_Store': new TextEncoder().encode('lixo'),
      }),
      messages,
    )

    expect(entries.map((entry) => entry.path)).toEqual(['pagina.md'])
  })

  it('bloqueia a importação inteira quando o zip tem caminho inseguro', async () => {
    const { error } = await runImport(
      zipSync({
        'ok.md': new TextEncoder().encode('# ok'),
        '../escapou.md': new TextEncoder().encode('# escapou'),
      }),
    )

    expect(error).toContain('caminhos inválidos')
  })
})

function data(files: Record<string, Uint8Array>) {
  return zipSync(files)
}

describe('nome de página do Notion', () => {
  it('remove o hash de 32 caracteres do título', () => {
    expect(notionTitle(
      'Plano de aula 1111111111111111111111111111aaaa.md',
      'Sem título',
    )).toBe(
      'Plano de aula',
    )
    expect(notionTitle('Base 4444444444444444444444444444dddd.csv', 'Sem título')).toBe('Base')
    expect(notionTitle('Sem hash.md', 'Sem título')).toBe('Sem hash')
  })
})

describe('csv do Notion', () => {
  it('lê célula com vírgula e aspas', () => {
    const rows = parseCsv('a,b\n"um, dois",três\n')

    expect(rows).toEqual([
      ['a', 'b'],
      ['um, dois', 'três'],
    ])
  })

  it('trunca colunas e linhas e avisa', () => {
    const header = Array.from({ length: 20 }, (_, index) => `c${index}`).join(',')
    const body = Array.from({ length: 250 }, (_, index) =>
      Array.from({ length: 20 }, () => String(index)).join(','),
    ).join('\n')

    const table = csvToMarkdownTable(`${header}\n${body}`)

    expect(table?.columns).toBe(12)
    expect(table?.rows).toBe(200)
    expect(table?.truncatedColumns).toBe(true)
    expect(table?.truncatedRows).toBe(true)
  })
})

describe('plano de importação', () => {
  it('mantém a pasta sem md como página de agrupamento', () => {
    const plan = buildImportPlan(
      readZipEntries(
        data({
          'Caderno/Aula 1111111111111111111111111111aaaa.md':
            new TextEncoder().encode('# Aula'),
        }),
        messages,
      ),
      messages.untitled,
    )

    expect(plan.pages.map((page) => page.title)).toEqual(['Aula'])
  })

  it('não achata a pasta raiz quando ela é uma página do Notion', () => {
    const plan = buildImportPlan(
      readZipEntries(
        data({
          'Caderno 1111111111111111111111111111aaaa/Aula 2222222222222222222222222222bbbb.md':
            new TextEncoder().encode('# Aula'),
        }),
        messages,
      ),
      messages.untitled,
    )

    expect(plan.pages.map((page) => page.title)).toEqual(['Caderno', 'Aula'])
    expect(plan.pages[1].parentKey).toBe(plan.pages[0].key)
  })
})

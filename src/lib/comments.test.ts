import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('@/db/schema')

  const sqlite = new Database(':memory:')
  const folder = join(process.cwd(), 'drizzle')

  sqlite.pragma('foreign_keys = ON')

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

import { db } from '@/db'
import { comments, documents, user } from '@/db/schema'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import {
  countOpenComments,
  createComment,
  deleteComment,
  getComment,
  listDocumentComments,
  setCommentResolved,
  updateCommentBody,
} from '@/lib/comments'

const author = { id: 'user-author', email: 'autor@arvore.com.br' }
const guest = { id: 'user-guest', email: 'convidado@arvore.com.br' }

async function seedComment(
  body: string,
  options: Readonly<{
    documentId?: string
    authorId?: string
    blockId?: string | null
    parentId?: string | null
    at?: number
  }> = {},
) {
  return createComment({
    documentId: options.documentId ?? 'doc-a',
    authorId: options.authorId ?? author.id,
    body,
    blockId: options.blockId ?? null,
    parentId: options.parentId ?? null,
    now: new Date(options.at ?? Date.now()),
  })
}

beforeEach(async () => {
  await db.delete(comments)
  await db.delete(documents)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [author, guest].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(documents).values([
    {
      id: 'doc-a',
      ownerId: author.id,
      title: 'Documento A',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-b',
      ownerId: author.id,
      title: 'Documento B',
      createdAt: now,
      updatedAt: now,
    },
  ])
})

describe('createComment', () => {
  it('cria um comentário ancorado num bloco', async () => {
    const id = await seedComment('Revisar este parágrafo', {
      blockId: 'block-1',
    })

    expect(id).not.toBeNull()

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.blockId).toBe('block-1')
    expect(threads[0]?.body).toBe('Revisar este parágrafo')
    expect(threads[0]?.authorName).toBe(author.email)
    expect(threads[0]?.resolvedAt).toBeNull()
  })

  it('recusa corpo vazio ou só com espaço', async () => {
    await expect(seedComment('   \n  ')).resolves.toBeNull()
    await expect(seedComment('')).resolves.toBeNull()
    await expect(countOpenComments('doc-a')).resolves.toBe(0)
  })

  it('apara o corpo e corta no limite', async () => {
    await seedComment(`  ${'a'.repeat(MAX_COMMENT_LENGTH + 50)}  `)

    const threads = await listDocumentComments('doc-a')

    expect(threads[0]?.body).toHaveLength(MAX_COMMENT_LENGTH)
  })

  it('cria resposta de um nível e ignora âncora própria', async () => {
    const root = await seedComment('Pergunta', { blockId: 'block-1' })
    const reply = await seedComment('Resposta', {
      blockId: 'block-9',
      parentId: root,
    })

    expect(reply).not.toBeNull()

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.replies).toHaveLength(1)
    expect(threads[0]?.replies[0]?.body).toBe('Resposta')

    const stored = await getComment('doc-a', reply as string)

    expect(stored?.parentId).toBe(root)
  })

  it('recusa resposta de resposta', async () => {
    const root = await seedComment('Pergunta')
    const reply = await seedComment('Resposta', { parentId: root })

    await expect(
      seedComment('Resposta da resposta', { parentId: reply }),
    ).resolves.toBeNull()
  })

  it('recusa resposta a comentário de outro documento', async () => {
    const root = await seedComment('Pergunta', { documentId: 'doc-b' })

    await expect(
      seedComment('Resposta', { documentId: 'doc-a', parentId: root }),
    ).resolves.toBeNull()
  })
})

describe('listDocumentComments', () => {
  it('lista as conversas mais novas primeiro e as respostas em ordem', async () => {
    const first = await seedComment('Primeira', { at: 1_000 })
    await seedComment('Segunda', { at: 2_000 })
    await seedComment('Resposta antiga', { parentId: first, at: 3_000 })
    await seedComment('Resposta nova', { parentId: first, at: 4_000 })

    const threads = await listDocumentComments('doc-a')

    expect(threads.map((thread) => thread.body)).toEqual([
      'Segunda',
      'Primeira',
    ])
    expect(threads[1]?.replies.map((reply) => reply.body)).toEqual([
      'Resposta antiga',
      'Resposta nova',
    ])
  })

  it('não mistura comentários de documentos diferentes', async () => {
    await seedComment('Do A', { documentId: 'doc-a' })
    await seedComment('Do B', { documentId: 'doc-b' })

    await expect(listDocumentComments('doc-a')).resolves.toHaveLength(1)
    await expect(listDocumentComments('doc-b')).resolves.toHaveLength(1)
  })
})

describe('countOpenComments', () => {
  it('conta só conversas raiz não resolvidas', async () => {
    const first = await seedComment('Primeira')
    await seedComment('Segunda')
    await seedComment('Resposta', { parentId: first })

    await expect(countOpenComments('doc-a')).resolves.toBe(2)

    await setCommentResolved(first as string, true)

    await expect(countOpenComments('doc-a')).resolves.toBe(1)
  })
})

describe('resolver e reabrir', () => {
  it('marca e desmarca sem alterar o updated_at do corpo', async () => {
    const id = (await seedComment('Trecho confuso', { at: 1_000 })) as string

    await setCommentResolved(id, true, new Date(5_000))

    const resolved = await getComment('doc-a', id)

    expect(resolved?.resolvedAt).toBe(5_000)

    const [threadResolved] = await listDocumentComments('doc-a')

    expect(threadResolved?.updatedAt).toBe(1_000)

    await setCommentResolved(id, false, new Date(9_000))

    await expect(getComment('doc-a', id)).resolves.toMatchObject({
      resolvedAt: null,
    })
  })

  it('não resolve uma resposta', async () => {
    const root = await seedComment('Pergunta')
    const reply = (await seedComment('Resposta', {
      parentId: root,
    })) as string

    await expect(setCommentResolved(reply, true)).resolves.toBe(false)
  })
})

describe('editar e excluir', () => {
  it('edita o corpo e avança o updated_at', async () => {
    const id = (await seedComment('Texto antigo', { at: 1_000 })) as string

    await expect(
      updateCommentBody(id, 'Texto novo', new Date(2_000)),
    ).resolves.toBe(true)

    const [thread] = await listDocumentComments('doc-a')

    expect(thread?.body).toBe('Texto novo')
    expect(thread?.updatedAt).toBe(2_000)
    expect(thread?.createdAt).toBe(1_000)
  })

  it('recusa edição para corpo vazio', async () => {
    const id = (await seedComment('Texto')) as string

    await expect(updateCommentBody(id, '   ')).resolves.toBe(false)

    const [thread] = await listDocumentComments('doc-a')

    expect(thread?.body).toBe('Texto')
  })

  it('excluir a raiz leva as respostas junto', async () => {
    const root = (await seedComment('Pergunta')) as string

    await seedComment('Resposta', { parentId: root })

    await expect(deleteComment(root)).resolves.toBe(true)
    await expect(db.select().from(comments)).resolves.toHaveLength(0)
  })

  it('excluir uma resposta mantém a conversa', async () => {
    const root = (await seedComment('Pergunta')) as string
    const reply = (await seedComment('Resposta', { parentId: root })) as string

    await deleteComment(reply)

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.replies).toHaveLength(0)
  })
})

describe('integridade', () => {
  it('apagar o documento apaga os comentários', async () => {
    await seedComment('Some comigo')

    await db.delete(documents).where(eq(documents.id, 'doc-a'))

    await expect(db.select().from(comments)).resolves.toHaveLength(0)
  })

  it('apagar a conta do autor mantém o comentário sem autor', async () => {
    await seedComment('Escrito por quem saiu', { authorId: guest.id })

    await db.delete(user).where(eq(user.id, guest.id))

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.authorId).toBeNull()
    expect(threads[0]?.authorName).toBeNull()
  })

  it('getComment não devolve comentário de outro documento', async () => {
    const id = (await seedComment('Do B', { documentId: 'doc-b' })) as string

    await expect(getComment('doc-a', id)).resolves.toBeNull()
    await expect(getComment('doc-b', id)).resolves.not.toBeNull()
  })
})

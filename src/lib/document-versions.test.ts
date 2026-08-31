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
import { documentVersions, documents, user } from '@/db/schema'
import {
  MAX_VERSIONS_PER_DOCUMENT,
  VERSION_THROTTLE_MS,
  applyDocumentVersion,
  getDocumentVersion,
  listDocumentVersions,
  pruneDocumentVersions,
  recordDocumentVersion,
} from '@/lib/document-versions'

const author = { id: 'user-author', email: 'autora@arvore.com.br', name: 'Ana' }
const mate = { id: 'user-mate', email: 'colega@arvore.com.br', name: '' }

const docId = 'doc-versionado'
const start = new Date('2026-08-30T12:00:00.000Z')

function at(offsetMs: number) {
  return new Date(start.getTime() + offsetMs)
}

async function setContent(content: string | null, title = 'Documento') {
  await db
    .update(documents)
    .set({ content, title })
    .where(eq(documents.id, docId))
}

beforeEach(async () => {
  await db.delete(documentVersions)
  await db.delete(documents)
  await db.delete(user)

  for (const person of [author, mate]) {
    await db.insert(user).values({
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      createdAt: start,
      updatedAt: start,
    })
  }

  await db.insert(documents).values({
    id: docId,
    ownerId: author.id,
    title: 'Documento',
    content: '[{"id":"a"}]',
    createdAt: start,
    updatedAt: start,
  })
})

describe('throttle', () => {
  it('grava a primeira versão e segura a segunda do mesmo autor dentro de 5 min', async () => {
    expect(await recordDocumentVersion(docId, author.id, { now: at(0) })).toBe(
      true,
    )

    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        now: at(VERSION_THROTTLE_MS - 1),
      }),
    ).toBe(false)

    expect(await listDocumentVersions(docId)).toHaveLength(1)
  })

  it('volta a gravar depois da janela de 5 min', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        now: at(VERSION_THROTTLE_MS),
      }),
    ).toBe(true)

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(2)
    expect(versions[0]?.createdAt).toBe(at(VERSION_THROTTLE_MS).getTime())
  })

  it('a janela é por autor', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, mate.id, { now: at(1_000) }),
    ).toBe(true)
    expect(await listDocumentVersions(docId)).toHaveLength(2)
  })

  it('force ignora a janela', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        force: true,
        now: at(1_000),
      }),
    ).toBe(true)
  })

  it('não grava versão quando o estado é idêntico ao da última versão', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })

    expect(
      await recordDocumentVersion(docId, mate.id, {
        force: true,
        now: at(1_000),
      }),
    ).toBe(false)
    expect(await listDocumentVersions(docId)).toHaveLength(1)
  })

  it('não grava versão de documento inexistente', async () => {
    expect(await recordDocumentVersion('doc-fantasma', author.id)).toBe(false)
  })
})

describe('poda', () => {
  it('mantém apenas as 50 versões mais recentes', async () => {
    const total = MAX_VERSIONS_PER_DOCUMENT + 5

    for (let index = 0; index < total; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Documento',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    expect(await pruneDocumentVersions(docId)).toBe(5)

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(MAX_VERSIONS_PER_DOCUMENT)
    expect(versions[0]?.id).toBe(`v-${String(total - 1).padStart(3, '0')}`)
    expect(versions.at(-1)?.id).toBe('v-005')
  })

  it('a poda acontece no insert', async () => {
    for (let index = 0; index < MAX_VERSIONS_PER_DOCUMENT; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Documento',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    await setContent('[{"id":"novo"}]')
    await recordDocumentVersion(docId, mate.id, {
      now: at(MAX_VERSIONS_PER_DOCUMENT * 1_000),
    })

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(MAX_VERSIONS_PER_DOCUMENT)
    expect(await getDocumentVersion(docId, versions[0]!.id)).toMatchObject({
      content: '[{"id":"novo"}]',
    })
    expect(versions.some((version) => version.id === 'v-000')).toBe(false)
  })

  it('a poda não toca versões de outro documento', async () => {
    await db.insert(documents).values({
      id: 'doc-vizinho',
      ownerId: author.id,
      title: 'Vizinho',
      content: null,
      createdAt: start,
      updatedAt: start,
    })

    await db.insert(documentVersions).values({
      id: 'v-vizinho',
      documentId: 'doc-vizinho',
      title: 'Vizinho',
      content: null,
      authorId: author.id,
      createdAt: at(0),
    })

    for (let index = 0; index < MAX_VERSIONS_PER_DOCUMENT + 3; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Documento',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    await pruneDocumentVersions(docId)

    expect(await listDocumentVersions('doc-vizinho')).toHaveLength(1)
  })
})

describe('restauração', () => {
  it('faz o round-trip guardando o estado atual antes de aplicar', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"depois"}]', 'Título novo')

    const restored = await applyDocumentVersion(
      docId,
      first!.id,
      mate.id,
      at(60_000),
    )

    expect(restored?.content).toBe('[{"id":"a"}]')

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"a"}]')
    expect(document?.title).toBe('Documento')

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(2)
    expect(await getDocumentVersion(docId, versions[0]!.id)).toMatchObject({
      content: '[{"id":"depois"}]',
      title: 'Título novo',
    })
  })

  it('devolve null para versão de outro documento', async () => {
    await db.insert(documents).values({
      id: 'doc-vizinho',
      ownerId: author.id,
      title: 'Vizinho',
      content: '[{"id":"vizinho"}]',
      createdAt: start,
      updatedAt: start,
    })

    await db.insert(documentVersions).values({
      id: 'v-vizinho',
      documentId: 'doc-vizinho',
      title: 'Vizinho',
      content: '[{"id":"vizinho"}]',
      authorId: author.id,
      createdAt: at(0),
    })

    expect(
      await applyDocumentVersion(docId, 'v-vizinho', author.id, at(1_000)),
    ).toBeNull()

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"a"}]')
  })

  it('restaurar duas vezes seguidas não duplica o snapshot idêntico', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"depois"}]')
    await applyDocumentVersion(docId, first!.id, author.id, at(60_000))
    await applyDocumentVersion(docId, first!.id, author.id, at(120_000))

    expect(await listDocumentVersions(docId)).toHaveLength(2)
  })
})

describe('listagem', () => {
  it('traz o autor e cai no email quando não há nome', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')
    await recordDocumentVersion(docId, mate.id, { now: at(1_000) })

    const versions = await listDocumentVersions(docId)

    expect(versions[0]?.authorName).toBe(mate.email)
    expect(versions[1]?.authorName).toBe('Ana')
  })

  it('sobrevive ao autor removido', async () => {
    await recordDocumentVersion(docId, mate.id, { now: at(0) })
    await db.delete(user).where(eq(user.id, mate.id))

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(1)
    expect(versions[0]?.authorId).toBeNull()
    expect(versions[0]?.authorName).toBeNull()
  })

  it('as versões somem junto com o documento', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await db.delete(documents).where(eq(documents.id, docId))

    expect(await listDocumentVersions(docId)).toHaveLength(0)
  })
})
